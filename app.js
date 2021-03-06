// Description
//   Responses or archives unused channels.
//
// Commands:
//   @APPID list ([0-9]+)days - returns unused channels
//   @APPID kill ([0-9]+)days - archives unused channels
//
// Author:
//   tyage <namatyage@gmail.com>

const { App } = require('@slack/bolt');
require('dotenv').config();
const fs = require('fs');

const cacheFile = 'cache.json';

let cachedData = null;
const readCache = () => {
  if (!cachedData) {
    try {
      const buf = fs.readFileSync(cacheFile);
      cachedData = JSON.parse(buf);
    } catch (_) {
      // do nothing if the file is broken
    }
  }
  return cachedData;
};
const writeCache = (data) => {
  const buf = JSON.stringify(data);
  fs.writeFileSync(cacheFile, buf);
  cachedData = data;
};

const findAllChannels = async (app, cursor = '') => {
  const { channels, response_metadata: { next_cursor: nextCursor } } = await app.client.conversations.list({
    token: process.env.SLACK_BOT_TOKEN,
    cursor,
    exclude_archived: true,
    types: 'public_channel',
    limit: 1000
  });
  if (nextCursor && nextCursor !== '') {
    const nextChannels = await findAllChannels(app, nextCursor);
    return [...channels, ...nextChannels];
  } else {
    return channels;
  }
};

const joinChannel = async (app, channel) => {
  await app.client.conversations.join({
    token: process.env.SLACK_BOT_TOKEN,
    channel
  });
};

const isChannelDisused = async (app, channel, threshold) => {
  const isMessageOld = (message, threshold) => {
    const messageTime = new Date(message.ts * 1000);
    const now = new Date();
    const thresholdMillSec = threshold * 24 * 60 * 60 * 1000;
    const isDisused = (now - messageTime) > thresholdMillSec;
    return isDisused;
  };

  const cachedChannels = readCache() || {};
  const cachedChannel = cachedChannels[channel];
  // if cached data is still new, return and do not update information
  if (cachedChannel && !isMessageOld(cachedChannel.lastMessage, threshold)) {
    return false;
  }

  let messages;
  try {
    const data = await app.client.conversations.history({
      token: process.env.SLACK_BOT_TOKEN,
      channel,
      limit: 10 // check last 10 messages
    });
    messages = data.messages;
  } catch (_) {
    // failed to fetch history
    return false;
  }
  let i = 0;
  let lastMessage = messages[0];
  // if the last message is join event, take next message so that we can ignore join event
  while (lastMessage && lastMessage.subtype === 'channel_join') {
    i++;
    lastMessage = messages[i];
  }
  // if there is no message, ignore this channel
  if (!lastMessage) {
    return false;
  }

  // update cache
  cachedChannels[channel] = {
    lastMessage
  };
  writeCache(cachedChannels);

  return isMessageOld(lastMessage, threshold);
};

const findDisusedChannels = async (app, threshold) => {
  const channels = await findAllChannels(app);
  const disusedChannels = [];
  for (let channel of channels) {
    console.log(`check ${channel.name}`);
    // join if not a member
    if (!channel.is_member) {
      await joinChannel(app, channel.id);
    }
    if (await isChannelDisused(app, channel.id, threshold)) {
      disusedChannels.push(channel.id);
    }
  }
  return disusedChannels;
};

const archiveChannel = async (app, channel) => {
  await app.client.conversations.archive({
    token: process.env.SLACK_BOT_TOKEN,
    channel
  });
};

const app = new App({
  logLevel: 'debug',
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

app.event('app_mention', async ({ event, say }) => {
  const message = event.text;
  const listPattern = /list ([0-9]+)days/;
  const archivePattern = /archive ([0-9]+)days/;
  // list 
  if (message.match(listPattern)) {
    await say('ちょっとまってね');
    const matches = message.match(listPattern);
    const day = +matches[1];
    const channels = await findDisusedChannels(app, day);
    const formattedChannels = channels.map(channel => `<#${channel}>`).join(',');
    await say(`channels disused for ${day}days: ${formattedChannels}`);

  // archive
  } else if (message.match(archivePattern)) {
    await say('ちょっとまってね');
    const matches = message.match(archivePattern);
    const day = +matches[1];
    if (day < 30) {
      return await say(`${day}日は短くない？`);
    }
    const channels = await findDisusedChannels(app, day);
    const formattedChannels = channels.map(channel => `<#${channel}>`).join(',');
    await say(`archiving channels disused for ${day}days: ${formattedChannels}`);

    for (let channel of channels) {
      await archiveChannel(app, channel);
    }

  } else {
    await say('???');
  }
});

// join channel if created or unarchived
app.event('channel_created', async ({ event }) => {
  const channel = event.channel;
  await joinChannel(app, channel.id);
});
app.event('channel_unarchive', async ({ event }) => {
  const channelId = event.channel;
  await joinChannel(app, channelId);
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app started');

  // await findDisusedChannels(app, 100);
})();