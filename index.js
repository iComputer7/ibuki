/*
 * Ibuki
 * 
 * Started Apr 18, 2020
 */

const Discord = require("discord.js");
const client = new Discord.Client();
const mysql = require("mysql");
const ytdl = require("ytdl-core");
const { google } = require("googleapis");
const youtube = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY
});

//config stuff
const prefix = process.env.BOT_PREFIX || "i!";
const token = process.env.BOT_TOKEN;
const sql_ip = process.env.SQL_HOST;
const sean = process.env.BOT_ADMIN;

//db connection
const db = mysql.createConnection({
    host: sql_ip,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASS,
    database: process.env.BOT_DB,
    charset: "utf8mb4_bin"
});

//functions
//lets me code commands faster
function simpleCommand(message, command, func) {
    if (message.content.toLowerCase().startsWith(`${prefix}${command}`)) {
        func(message.content.substring(command.length + prefix.length + 1));
    }
}

//logs stuff to the general log table
function general_log(db, e_type, e_details, callback) {
    let timestamp = new Date(); //getting a timestamp
    db.query("INSERT INTO general_log SET ?", { //querying the database
        event_type: e_type,
        event_details: e_details,
        timestamp: timestamp.getTime()
    }, (err, res) => {
        if (typeof callback === "function") { callback(); } //if there is a callback function, run it
        if (err) { console.error(`General_log error: ${err}`); } //if there is an error, log it
    });
}

//gives mikan despair disease
function kill(db) {
    general_log(db, "killed", "Ibuki killed.", () => {
        client.destroy();
        process.exit();
    });
}

var server_queues = new Map();

function connectedToVoice(guild) {
    if (guild.voice === undefined) return false;
    else if (guild.voice.connection === undefined) return false;
    else return !(guild.voice.connection === null);
}

async function addToQueue(arg, message) {
    return new Promise(async (res, rej) => {
        let queue = ServerQueue.get(message.guild.id);
        if (arg.includes("/playlist") && !arg.includes("watch")) {
            //google api only accepts ids instead of URLs so we need to parse the playlist id
            let listid = arg.slice(arg.indexOf("=") + 1);
            //video assumed to be playlist so break it down into individual videos and add each video to the queue
            const listdata = await youtube.playlistItems.list({
                part: "id,snippet,contentDetails",
                playlistId: listid,
                maxResults: 50
            });

            //keeping track of videos that we need to grab info for, and what we already grabbed
            let needs_info = [], has_info = [];
            //adding 1st page of stuff to the list
            for (video of listdata.data.items) needs_info.push(video.contentDetails.videoId);

            //making this a function to make life easier
            //grabs data for each video and puts it in the array
            let getVideoData = async () => {
                return new Promise(async (res, rej) => {
                    //asserting that we're not trying to grab info on more than 50 videos at a time
                    if (needs_info.length > 50) return rej("Tried to grab info on more than 50 videos.");

                    //now we actually grab the information
                    let video_info; //gotta define this ahead of time i suppose

                    //get data from youtube and catch errors
                    try {
                        video_info = await youtube.videos.list({
                            part: "snippet,contentDetails",
                            maxResults: 50,
                            id: needs_info.join(",")
                        });
                    } catch (e) {
                        //oopsie poopsie there's an error so stop
                        return rej(e);
                    }

                    //adding 1st page of stuff to the list
                    for (video of video_info.data.items) has_info.push(video);

                    //clearing the array because we already got info on those videos
                    needs_info = [];

                    //got that data so resolve
                    res();
                });
            };

            //checking if there are more pages, totalResults = amount of videos in the playlist
            if (listdata.data.pageInfo.totalResults > 50) {
                //there are more pages, so get all the pages
                if (listdata.data.nextPageToken === undefined) return rej("There should be more pages but YouTube didn't give a token for the next page.");

                //get the first page of stuff
                await getVideoData();

                //looping through each page
                while (has_info.length < listdata.data.pageInfo.totalResults) {
                    //we have a token for the next page so grab the next page in the playlist
                    let nextdata = await youtube.playlistItems.list({
                        part: "id,snippet,contentDetails",
                        playlistId: listid,
                        maxResults: 50,
                        pageToken: listdata.data.nextPageToken
                    });
                    //add the contents of that page, preparing for when we grab info on the videos
                    for (video of nextdata.data.items) needs_info.push(video.contentDetails.videoId);

                    //grab info for those videos
                    await getVideoData();
                }
                //loop done
            }
            //only one page so grab info on that one page and be done
            else await getVideoData();

            //now we add all the videos into the bot's queue
            for (item of has_info) {
                //looping through and doing it one at a time
                queue.add(item, message.member);
            }

            //everything's all good, so resolve promise and move on
            return res();
        } else {
            //not a playlist so just search for it if it's not a valid link
            let id;
            if (!ytdl.validateURL(arg)) {
                //invalid url, so search for it. only the 1st video is needed so we don't need to request any more from the api
                let search = await youtube.search.list({
                    part: "id",
                    type: "video",
                    maxResults: 1,
                    q: arg
                });
                id = search.data.items[0].id.videoId;
            } else {
                //valid url so grab info on it
                //parsing id from url
                try {
                    id = ytdl.getURLVideoID(arg);
                } catch (e) {
                    return rej(e);
                }
            }
            //got valid id, get info on video
            let video_info = await youtube.videos.list({
                part: "snippet,contentDetails",
                maxResults: 1,
                id: id
            });

            //add it to the queue
            queue.add(video_info.data.items[0], message.member);

            //did all we needed to do, so resolve and move on
            return res();
        }
    });
}
//end functions


//classes
class ServerQueue {
    //guild - the discord.js object of the guild this queue belongs to
    constructor(guild) {
        //storing the guild that this belongs to
        this.guild = guild;
        this.guild_id = guild.id;

        //setting up queues
        this.past = [];
        this.current = [];

        //keeps track of if this queue is active or not
        this.paused = false;
        this.playing = false;
    }

    previous() {
        this.current.push(this.past[this.past.length - 1]);
        this.past.shift();
        ServerQueue.update(this);
    }

    next() {
        this.past.push(this.current[0]);
        this.current.shift();
        ServerQueue.update(this);
    }

    clear(force) {
        if (force === undefined) force = false;
        this.past = [];
        if (this.playing && !force) this.current = [this.latest];
        else this.current = [];
        ServerQueue.update(this);
    }

    move(orig, new_pos) {
        this.current.move(orig, new_pos);
        ServerQueue.update(this);
    }

    add(video, from) {
        this.current.push(new QueueObject(this.guild, video, from));
        ServerQueue.update(this);
    }

    togglePause() {
        this.paused = !this.paused;
    }

    shuffle() {
        let array = this.current;
        let np = this.current[0];
        array.shift();
        let counter = array.length;

        // While there are elements in the array
        while (counter > 0) {
            // Pick a random index
            let index = Math.floor(Math.random() * counter);

            // Decrease counter by 1
            counter--;

            // And swap the last element with it
            let temp = array[counter];
            array[counter] = array[index];
            array[index] = temp;
        }
        array.unshift(np);
        this.current = array;
        ServerQueue.update(this);
    }

    addTop(from, video) {
        this.current.unshift(new QueueObject(this.guild, video, from));
        ServerQueue.update(this);
    }

    setPlaying() {
        this.playing = true;
        ServerQueue.update(this);
    }

    setNotPlaying() {
        this.playing = false;
        ServerQueue.update(this);
    }

    remove(index) {
        this.current.splice(index, 1);
        ServerQueue.update(this);
    }

    static get(guild_id) {
        return server_queues.get(guild_id);
    }

    static update(modified) {
        server_queues.set(modified.guild_id, modified);
    }

    get latest() {
        return this.current[0];
    }

    get length() {
        return this.current.length;
    }

    get prevLength() {
        return this.past.length;
    }

    get formatted() {
        let items = this.current.slice(0, 11), formatted = [];
        items.forEach((v, i) => {
            formatted.push(`${(i == 0) ? "Now Playing:" : `${i}.`} ${v.title} by ${v.uploader.name} - Requested by ${v.from.displayName}`);
        });
        if (items.length > 11) formatted.push(`${items.length - 10} more...`);
        return `\`\`\`\n${formatted.join("\n")}\`\`\``;
    }

    get nextitem() {
        return this.current[1];
    }

    get empty() {
        return (this.current < 1);
    }
}
class QueueObject {
    constructor(guild, video, from) {
        //guild - what guild this object belongs to, video - the raw video object from youtube's api, from - the user that requested this object
        this.guild = guild;
        this.from = from;

        //making youtube api output more legible
        this.rawOutput = video;
        this.title = video.snippet.title;
        if (typeof video.id === "string") this.videoId = video.id;
        else this.videoId = video.id.videoId;
        this.uploaded = Date.parse(video.snippet.publishedAt);
        this.uploader = {
            id: video.snippet.channelId,
            name: video.snippet.channelTitle
        };
        this.duration = video.contentDetails.duration;
    }

    get url() {
        return `https://youtube.com/watch?v=${this.videoId}`;
    }

    get embedFormatted() {
        return {
            embed: {
                hexColor: "#ff5733",
                author: {
                    name: client.user.username,
                    icon_url: client.user.displayAvatarURL()
                },
                fields: [
                    {
                        name: "Title",
                        value: this.title,
                        inline: true
                    },
                    {
                        name: "Author",
                        value: this.uploader.name,
                        inline: true
                    },
                    {
                        name: "Requested by",
                        value: this.from.displayName,
                        inline: true
                    },
                    {
                        name: "Queue Length",
                        value: ServerQueue.get(this.guild).length,
                        inline: true
                    }
                ]
            }
        };
    }
}
//end classes

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({ activity: { name: `${prefix}help`, type: "LISTENING" }, status: "online" });
    db.connect(err => {
        if (err) console.error(err)
        else console.log(`Connected. MySQL server IP: ${sql_ip}`);
    });

    //adding queues for each server
    client.guilds.cache.each((guild) => {
        server_queues.set(guild.id, new ServerQueue(guild.id));
    });
});

client.on("message", async (message) => {
    //admin only
    if (message.author.id == sean) {
        simpleCommand(message, "servers", (arg) => {
            let formatted_guilds = [];
            for (g in client.guilds.cache.array()) formatted_guilds.push(`${client.guilds.cache.array()[g].name} (ID: ${client.guilds.cache.array()[g].id}) `);
            message.channel.send(formatted_guilds.join("\n"));
        });
        simpleCommand(message, "kill", (arg) => kill(db));
    }

    //general commands
    simpleCommand(message, "play", async (arg) => {
        if (message.member.voice.channel) { //user is in voice channel
            let vc = message.member.voice.channel; //alias for the voice channel

            if (!vc.joinable) {
                //can't join vc
                message.reply(`I don't have permission to join ${vc.name}.`);
            } else {
                //join vc
                let queue = ServerQueue.get(message.guild.id);

                //adding video to queue while weeding out bad links and parsing playlists
                //ignoring video links with playlists attached on the end because nobody likes those
                let error = false;
                await addToQueue(arg, message).catch((e) => error = e);
                if (error != false) return message.reply(error);

                //not in a voice channel so join one
                if (!connectedToVoice(message.guild)) {
                    vc.join().then(conn => {
                        let play = (item) => {
                            queue.setPlaying();
                            message.channel.send(queue.latest.embedFormatted);

                            conn.play(ytdl(item.url, { quality: "highestaudio", highWaterMark: 1024 * 1024 * 10 })).on("finish", () => {
                                queue.next();
                                if (!queue.empty) play(queue.latest);
                                else {
                                    conn.disconnect();
                                    queue.clear();
                                    queue.setNotPlaying();
                                }
                            }).on("error", console.error);
                        };

                        play(queue.latest);
                    }).catch(console.error);
                } else {
                    //in a voice channel so just say that it's been added
                    message.channel.send("Added to the queue.", queue.nextitem.embedFormatted);
                }
            }

        } else message.reply("You're not in a voice channel.");
    });

    simpleCommand(message, "disconnect", (arg) => {
        //in a voice channel, so leave
        if (connectedToVoice(message.guild)) message.guild.voice.connection.disconnect();
        //not in a voice channel, so warn user
        else return message.reply("I'm not in a voice channel.");

    });

    simpleCommand(message, "stop", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //bot is in vc
            queue.clear(true);
            message.guild.voice.connection.disconnect();
        }
        //bot isn't in vc, so warn user
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "queue", (arg) => {
        let queue = ServerQueue.get(message.guild.id);

        if (!queue.empty) message.channel.send(queue.formatted);
        else message.channel.send("Queue is empty.");
    });

    simpleCommand(message, "skip", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //in voice
            let dispatcher = message.guild.voice.connection.dispatcher;
            //bot not playing song, so warn user
            if (dispatcher === null) return message.reply("I'm not playing anything.");
            //bot playing song, so skip to the next one
            return dispatcher.end();
        }
        //not in vc so warn user
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "prev", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //bot in voice
            let dispatcher = message.guild.voice.connection.dispatcher;
            //bot not playing, so warn user
            if (dispatcher === null) return message.reply("I'm not playing anything.");
            //move the queue back, then play the new current song
            if (queue.prevLength == 0) return message.reply("There's nothing to go back to.");
            queue.previous();
            dispatcher.end();
        }
        //not in vc so warn user
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "pause", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //bot in voice
            let dispatcher = message.guild.voice.connection.dispatcher;
            if (!queue.paused) {
                //bot not paused, so pause
                dispatcher.pause();
                queue.togglePause();
                message.channel.send(`Paused. Use ${prefix}resume to resume.`);
            }
            //bot is already paused, so warn user
            else return message.reply("I'm already paused.");
        }
        //bot isn't in voice
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "resume", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //in voice
            let dispatcher = message.guild.voice.connection.dispatcher;
            if (queue.paused) {
                //bot is paused so unpause it
                dispatcher.resume();
                queue.togglePause();
                message.channel.send("Playing.");
            }
            //bot not paused
            else message.reply("I'm already playing.");
        }
        //bot not in voice, so warn user
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "clear", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        queue.clear();
        return message.reply("Queue has been cleared.");
    });

    simpleCommand(message, "move", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        if (connectedToVoice(message.guild)) {
            //in voice
            let commands = arg.split(",");
            //impossible to parse arguments
            if (commands.length != 2) return message.reply(`Invalid arguments. Try ${prefix}move (from),(to)`);
            //parsing args
            let from = parseInt(commands[0]), to = parseInt(commands[1]);
            //asserting that everything is correct
            if (isNaN(to) || isNaN(from)) return message.reply(`Invalid arguments. Please use numbers. Try ${prefix}move (from),(to)`);
            if (to < 1 || from < 1) return message.reply(`Invalid position. Queue positions start at 1. Try ${prefix}move (from),(to)`);
            if (from > queue.length - 1 || to > queue.length - 1) return message.reply(`Position is outside of queue. Try ${prefix}move (from),(to)`);
            //performing the move
            queue.move(from, to);
        }
        //not in voice
        else return message.reply("I'm not in a voice channel.");
    });

    simpleCommand(message, "shuffle", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        //already empty queue, warn user
        if (queue.empty) return message.reply("The queue is empty.");
        //queue not empty, so shuffle
        else queue.shuffle();
        //let user know that queue is shuffled
        return message.reply("Queue has been shuffled.");
    });

    simpleCommand(message, "addtop", async (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        //bot not playing
        if (queue.empty) return message.reply("I have to be playing music to be able to add things to the queue.");

        //passing this to the addToQueue function, and checking if there are no errors
        let error = false;
        await addToQueue(arg, message).catch((e) => error = e);
        if (error != false) return message.reply(error);
        else return;
    });

    simpleCommand(message, "help", (arg) => {
        db.query("SELECT * FROM help", (err, res, fields) => {
            if (err) return message.reply(`Error getting info from the database: ${err}`, { split: true });
            let commands = [];
            if (arg == "") {
                //no argument given, so list all available commands
                res.forEach((cmd) => {
                    //shows non-hidden commands for regular users
                    if (cmd.type != "hidden") commands.push(cmd.command);
                    //but if the admin issued the command then show the hidden commands and show which ones are hidden
                    else if (message.author.id == sean && cmd.type == "hidden") commands.push(cmd.command + " (HIDDEN)");
                });
                //sort list in alphabetical order
                commands.sort();
                //sending the completed message
                return message.channel.send(`COMMANDS: \n(use ${prefix}help [command] for more information)\n-------------------\n${commands.join("\n")}`);
            } else {
                //How this works: Command is assumed to be not found. Database is searched for the command and if it's there then it's marked as found. Info is sent to the chat.
                let found = false;
                res.forEach((cmd) => {
                    if (!found) {
                        if (cmd.command == arg) {
                            //found the command in the db, give more info on it
                            found = true;
                            return message.channel.send(`More info for command ${arg}: \n-------------------\n${cmd.usage.replace(/%prefix%/g, prefix)}`);
                        }
                    }
                });

                //couldn't find command in db
                if (!found) return message.reply(`Command ${arg} not found.`);
            }
        });
    });

    simpleCommand(message, "remove", (arg) => {
        let queue = ServerQueue.get(message.guild.id);
        //queue is empty, warn user
        if (queue.empty) return message.reply(`Queue is empty.`);
        //attempting to parse argument
        let index = parseInt(arg);
        //asserting that the argument is valid
        if (isNaN(index)) return message.reply(`Invalid argument. Please use numbers. Try ${prefix}remove (item index)`);
        if (index < 1) return message.reply(`Invalid position. Queue positions start at 1. Try ${prefix}remove (item index)`);
        if (index > queue.length - 1) return message.reply(`Position is outside of queue. Try ${prefix}remove (item index)`);
        //valid argument, remove the queue object
        queue.remove(index);
        //show them what the queue looks like now
        return message.channel.send(queue.formatted);
    });
});

client.on("guildCreate", (g) => {
    console.log(`I have been added to a new server! It is called ${g.name} and its ID is ${g.id}`);
    general_log(db, "guild_create", `${g.name} (ID: ${g.id})`);
    server_queues.set(g.id, new ServerQueue(g.id));
});

client.on("guildDelete", (g) => {
    console.log(`I have been removed from a server! It is called ${g.name} and its ID is ${g.id}`);
    general_log(db, "guild_delete", `${g.name} (ID: ${g.id})`);
});

client.on("guildUnavailable", (g) => {
    console.log(`${g.name} (ID: ${g.id}) has become unavailable.`);
    general_log(db, "guild_unavailable", `${g.name} (ID: ${g.id})`);
});

client.on("reconnecting", () => {
    console.log("I have lost connection with Discord servers. Reconnecting....");
    general_log(db, "reconnecting", "Reconnecting to Discord servers");
})


client.login(token);

process.on("SIGINT", () => kill(db));
