# QueueObject

## Initialization

`new QueueObject(guild, video, from)`

* `guild`: The guild that the object belongs to. (Discord.js Guild class)
* `video`: The raw output from the YouTube API. (YouTube Video object)
* `from`: The person that requested this object. (Discord.js GuildMember class)

---

## Get

* `this.url`: (string) The URL of the video.
* `this.embedFormatted`: (Embed) The embed that gets sent when this object is being played.

---

## Variables

* `this.guild`: (Guild) The guild that this object belongs to.
* `this.from`: (GuildMember) The person that requested this object.
* `this.rawOutput`: (Video) The raw output from the YouTube API.
* `this.title`: (string) The title of this video.
* `this.videoId`: (string) The YouTube ID of this video.
* `this.uploaded`: (Date) When this video was uploaded.
* `this.uploader`: (object) The person who uploaded this video.
* `this.uploader.id`: (string) The channel ID of the uploader.
* `this.uploader.name`: (string) The channel name of the uploader.
* `this.duration`: (string) The unformatted length of the video.