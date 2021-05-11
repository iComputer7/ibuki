# Ibuki

A music bot coded from scratch. Originally was a private project for my friends and I but is now open source.

---

# To-do list:
* Now playing command that shows how far into the song you are and where it is in the queue

---

# Further down the line:
* Shuffle play command, automatically shuffles playlists

---

# Environment Variables

* `YT_API_KEY` - Youtube API key
* `BOT_PREFIX` - (optional) The prefix for commands. Default is `i!`
* `BOT_TOKEN` - The bot's Discord token.
* `BOT_ADMIN` - The specified Discord user ID gets access to admin commands.
* `SQL_HOST` - MySQL server hostname or IP address
* `SQL_USER` - MySQL username. Must have INSERT and SELECT permissions for the specified database.
* `SQL_PASS` - MySQL password.
* `BOT_DB` - MySQL database that the bot will use. This database must have both tables that are defined in the Mandatory SQL Tables section.


---

# Mandatory SQL Tables

The bot relies on MySQL tables being the right format. Here's the relevant SQL to recreate them:

`general_log` - 

```
CREATE TABLE `general_log` (
    `id` int(8) NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `event_type` varchar(500) NOT NULL,
    `event_details` varchar(5000) DEFAULT NULL,
    `timestamp` bigint(100) NOT NULL
);
```

`help` - 

```
CREATE TABLE `help` (
    `id` int(6) PRIMARY KEY AUTO_INCREMENT,
    `command` varchar(100),
    `usage` varchar(2000),
    `type` varchar(100)
);
```

---

# Building

Install docker and run this command on the root folder of the repository:

```
docker build -t ibuki .
```

