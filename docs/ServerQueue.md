# ServerQueue

## Initialization

`new ServerQueue(guild)`

* `guild`: The discord.js Guild object of the guild that this queue belongs to.

---

## Variables

* `this.guild`: (Guild) The guild that this queue belongs to.
* `this.guild_id`: (string) The ID of the guild that this queue belongs to.
* `this.past`: (Array) A record of the past objects in the queue.
* `this.current`: (Array) The objects that are currently in the queue. Index 0 is what is currently being played.
* `this.paused`: (boolean) Is the player paused?
* `this.playing`: (boolean) Is the player currently playing?

---

## Methods

* `this.previous()`: Takes the last thing in the previous queue and puts it on the top of the current queue.
* `this.next()`: Takes the top object in the current queue, copies it to the previous queue, then shifts the current queue.
* `this.clear(force: boolean)`: Empties the previous and current queue. If force = false then current queue index 0 (now playing) will be ignored.
* `this.move(orig: int, new_pos: int)`: Takes object at position `orig` and moves it to position `new_pos`
* `this.add(video: object, from: GuildMember)`: Takes YouTube video object `video` and creates a `QueueObject` class with it. `from` is the GuildMember that requested the object.
* `this.shuffle()`: Shuffles the current queue without disturbing position 0 (now playing)
* `this.addTop(from: GuildMember, video: object)`: Same as `this.add` but the new object is added to the top of the current queue.
* `this.setPlaying()`: Changes `this.playing` to true and updates the queue.
* `this.setNotPlaying()`: Changes `this.playing` to false and updates the queue.
* `this.remove(index: int)`: Removes the object at index `index` in the current queue.

---

## Static

* `ServerQueue.get(guild_id: string)`: Returns the queue that belongs to the specified guild.
* `ServerQueue.update(modified: ServerQueue)` Updates the map with the new ServerQueue `modified`

---

## Get

* `this.latest`: (QueueObject) Returns position 0 of the current queue.
* `this.length`: (int) Returns the length of the current queue.
* `this.formatted`: (string) Formatted Discord message that shows what's in the current queue.
* `this.nextitem`: (QueueObject) Returns position 1 of the current queue.
* `this.empty`: (boolean) Shows if the current queue is empty.