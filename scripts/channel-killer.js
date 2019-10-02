// Description
//   Responses or archives unused channels.
//
// Configuration:
//   None
//
// Commands:
//   hubot list ([0-9]+)days - returns unused channels
//   hubot kill ([0-9]+)days - archives unused channels
//
// Author:
//   tyage <namatyage@gmail.com>

const { RtmClient } = require('@slack/rtm-api')
const { WebClient } = require('@slack/web-api')

const token = process.env.HUBOT_SLACK_TOKEN
const web = new WebClient(token)
const rtm = new RtmClient(token)

const channelsCache = new Map() 
const getChannel = (id) => channelsCache.get(id)
const deleteChannel = (id) => {
  channelsCache.delete(id)
}

const sleep = (milsec) => {
  return new Promise((res, rej) => {
    setTimeout(() => res(), milsec)
  })
} 

// channelのcacheを更新する
const updateChannelInfo = async (id) => {
  const channelInfo = getChannel(id)
  if (!channelInfo) {
    return
  }
  const info = await web.channels.info({ channel: id })
  if (!info) {
    return
  }
  channelInfo.latest = info.channel.latest
}
// channelにjoin. 入れない場合は API limit に引っかかっている可能性があるのでwaitを入れる
const joinChannel = async (id) => {
  const channel = getChannel(id)
  try {
    await web.channels.join({ name: channel.name })
    updateChannelInfo(id)
  } catch (e) {
    console.log(`can not join in ${channel.name} . wait 10sec`)
    await sleep(1000 * 10)
  }
}
const joinAllChannels = async () => {
  const channelList = await web.channels.list({ exclude_archived: true, exclude_members: true }).channels
  for (let channel of channelList) {
    if (!channel.is_member && !channel.is_archived) {
      await joinChannel(channel.id)
    }
  }
}
const updateChannelsInfo = async (channels) => {
  for (let channel of channels) {
    await updateChannelInfo(channel.id)
  }
}
const isChannelUnused = async (id, threshold) => {
  const channel = getChannel(id)
  if (channel.is_archived) {
    return false
  }

  // channel.latestはjoinしているチャンネルしか取得できないのでjoinする
  // joinするとlatestが更新されてしまうので、結果を取得しても意味がない。そのままreturnする
  if (!channel.latest) {
    await joinChannel(id)
    return false
  }

  const lastUpdate = new Date(channel.latest.ts * 1000);
  const now = new Date()
  const isUnsed = (now - lastUpdate) > threshold
  return isUnsed
}
const getUnusedChannels = async (threshold) => {
  const unusedChannels = []
  for (const id of channelsCache.keys()) {
    if (await isChannelUnused(id, threshold)) {
      unusedChannels.push(id)
    }
  }
  return unusedChannels
}

// RTM
rtm.start()
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  console.log('logged in')
  channels = rtmStartData.channels;
  joinAllChannels();
  updateChannelsInfo(channels);
});
rtm.on(RTM_EVENTS.MESSAGE, function(message) {
  var channel = getChannel(message.channel);
  if (channel) {
    channel.latest = message;
  }
});
rtm.on(RTM_EVENTS.CHANNEL_LEFT, function(message) {
  var channel = getChannel(message.channel);
  if (channel) {
    joinChannel(channel);
  }
});
rtm.on(RTM_EVENTS.CHANNEL_UNARCHIVE, function(message) {
  var channel = getChannel(message.channel);
  if (channel) {
    joinChannel(channel);
  }
});
rtm.on(RTM_EVENTS.CHANNEL_CREATED, function(message) {
  joinChannel(message.channel);
});
rtm.on(RTM_EVENTS.CHANNEL_DELETED, function(message) {
  deleteChannel(message.channel);
});

// hubot
module.exports = function(robot) {
  var formatChannels = function(channels) {
    return channels.map(function(channel) {
      return "#" + channel.name;
    }).join(' ');
  };

  // say the list of channels to be killed
  robot.hear(new RegExp(robot.name + ' list ([0-9]+)days', 'i'), function(res) {
    var days = parseInt(res.match[1]);
    var threshold = days * 24 * 60 * 60 * 1000;
    res.reply('Following channels are not used for ' + days + 'days:');

    var channels = getUnusedChannels(threshold);
    res.reply(formatChannels(channels));
  });

  // archive the channel
  robot.hear(new RegExp(robot.name + ' kill ([0-9]+)days', 'i'), function(res) {
    var days = parseInt(res.match[1]);
    var threshold = days * 24 * 60 * 60 * 1000;
    res.reply('Following channels will be archived:');

    var channels = getUnusedChannels(threshold);
    channels.forEach(function(channel) {
      web.channels.archive(channel.id);
    });
    res.reply(formatChannels(channels));
  });
};
