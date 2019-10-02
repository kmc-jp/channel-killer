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
// 更新できない場合は API limit に引っかかっている可能性があるのでwaitを入れる
const updateChannelInfo = async (id) => {
  const channel = getChannel(id)
  if (!channel) {
    return
  }
  try {
    const newData = await web.channels.info({ channel: id })
    if (!newData) {
      return
    }
    channel.latest = newData.channel.latest
  } catch (e) {
    // TODO: retry X times
    // XXX: if it always fail, channel.latest will not be updated. and channel-killer may kills the channel
    console.log(`can not get info of ${channel.name} . wait 10sec`)
    await sleep(1000 * 10)
    return
  }
}
// channelにjoin
// 入れない場合は API limit に引っかかっている可能性があるのでwaitを入れる
const joinChannel = async (id) => {
  const channel = getChannel(id)
  try {
    await web.channels.join({ name: channel.name })
    updateChannelInfo(id)
  } catch (e) {
    // TODO: retry X times
    // XXX: if it always fail, channel.latest will not be updated. and channel-killer may kills the channel
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
const updateAllChannelsCache = async () => {
  for (let id of channelsCache.keys()) {
    await updateChannelInfo(id)
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
rtm.start().catch(console.error)
rtm.on('ready', async (rtmStartData) => {
  console.log('logged in')
  initChannels(rtmStartData.channels)
  await joinAllChannels()
  await updateAllChannelsCache()
})
rtm.on('message', async (message) => {
  const channel = getChannel(message.channel)
  if (channel) {
    channel.latest = message
  }
})
rtm.on('channel_left', async (message) => {
  const channel = getChannel(message.channel)
  if (channel) {
    await joinChannel(channel.id)
  }
})
rtm.on('channel_unarchive', async (message) => {
  const channel = getChannel(message.channel)
  if (channel) {
    await joinChannel(channel.id)
  }
})
rtm.on('channel_created', async (message) => {
  await joinChannel(message.channel.id)
})
rtm.on('channel_deleted', async (message) => {
  deleteChannel(message.channel.id);
});

// hubot
module.exports = (robot) => {
  const formatChannels = (channels) => {
    return channels.map(function(channel) {
      return "#" + channel.name
    }).join(' ')
  }

  // say the list of channels to be killed
  robot.hear(new RegExp(robot.name + ' list ([0-9]+)days', 'i'), async (res) => {
    const days = parseInt(res.match[1])
    const threshold = days * 24 * 60 * 60 * 1000

    const channels = await getUnusedChannels(threshold)
    const unusedChannels = formatChannels(channels)
    res.reply(`Following channels are not used for ${days} days: ${unusedChannels}`)
  });

  // archive the channel
  robot.hear(new RegExp(robot.name + ' kill ([0-9]+)days', 'i'), async (res) => {
    const days = parseInt(res.match[1])
    const threshold = days * 24 * 60 * 60 * 1000
    res.reply('Following channels will be archived:')

    const channels = await getUnusedChannels(threshold);
    channels.forEach((channel) => {
      await web.channels.archive(channel.id);
    })
    const archivedChannels = formatChannels(channels);
    res.reply(`Following channels will be archived: ${archivedChannels}`)
  });
};
