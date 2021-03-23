// Description
//   Responses or archives unused channels.
//
// Configuration:
//   None
//
// Commands:
//   @APPID list ([0-9]+)days - returns unused channels
//   @APPID kill ([0-9]+)days - archives unused channels
//
// Author:
//   tyage <namatyage@gmail.com>

const { App } = require('@slack/bolt');
require('dotenv').config();
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
  // TODO: cache in file
  const { messages } = await app.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel,
    limit: 2
  });
  const lastMessage = messages[0];
  if (!lastMessage) {
    return false;
  }
  // TODO: if last message is join event, look next message
  const lastUpdate = new Date(lastMessage.ts * 1000);
  const now = new Date();
  const isDisused = (now - lastUpdate) > threshold * 60 * 60 * 24;
  return isDisused;
}

const findDisusedChannels = async (app, threshold) => {
  const channels = await findAllChannels(app);
  const disusedChannels = [];
  console.log(channels.length)
  for (channel of channels) {
    console.log(`check ${channel.name}`)
    // join if not a member
    if (!channel.is_member) {
      await joinChannel(app, channel.id);
    }
    if (await isChannelDisused(app, channel.id, threshold)) {
      disusedChannels.push(channel.id);
    }
  }
  return disusedChannels;
}

const listChannels = () => {
  return 'poe'
}

const app = new App({
  logLevel: 'debug',
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

app.event('app_mention', async({ event, say }) => {
  const message = event.text
  // list 
  if (message.includes('list')) {
    const matches = message.match(/list ([0-9]+)days/);
    if (matches) {
      const day = matches[1];
      const channels = await listChannels(app, day);
      await say(`channels unused for ${day}days: ${channels}`);
    }

  // archive
  } else if (message.includes('archive')) {

  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app started');

  unusedChannels = await findDisusedChannels(app, 100);
  console.log(unusedChannels)
})();