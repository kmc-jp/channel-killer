// Description
//   Responses or archives unused channels.
//
// Configuration:
//   None
//
// Commands:
//   hubot list ([0-9]+)days - returns unused channels
//   hubot kill ([0-9]+)days - archives unused channels
//   hubot status - returns bot status
//   hubot reload data - request latest channels info
//
// Author:
//   tyage <namatyage@gmail.com>

const { RTMClient } = require('@slack/rtm-api')
const { WebClient } = require('@slack/web-api')

const token = process.env.HUBOT_SLACK_TOKEN
const web = new WebClient(token)
const rtm = new RTMClient(token)
rtm.useRtmConnect = false

const sleep = (milsec) => {
  return new Promise((res, rej) => {
    setTimeout(() => res(), milsec)
  })
} 

const channelsCache = new Map()
const channelUpdatedMap = new Map()
const initChannelsCache = (channels) => {
  for (let channel of channels) {
    if (channel.is_archived || channel.is_private) {
      continue
    }
    channelsCache.set(channel.id, channel)
    channelUpdatedMap.set(channel.id, false)
  }
}
const getChannel = (id) => channelsCache.get(id)
const deleteChannel = (id) => {
  channelsCache.delete(id)
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
      throw new Exception()
    }
    channel.latest = newData.channel.latest
    channelUpdatedMap.set(id, true)
  } catch (e) {
    // TODO: retry X times
    console.log(`can not get info of ${channel.name} . wait 10sec`)
    channelUpdatedMap.set(id, false)
    await sleep(1000 * 10)
    return
  }
}
const updateAllChannelsCache = async () => {
  for (let id of channelsCache.keys()) {
    await updateChannelInfo(id)
  }
}
const isChannelUpdated = (id) => channelUpdatedMap.get(id)
const getUnUpdatedChannels = () => {
  const result = []
  for (let [id, value] of channelUpdatedMap.entries()) {
    if (value === false) {
      result.push(id)
    }
  }
  return result
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
    console.log(`can not join in ${channel.name} . wait 10sec`)
    channelUpdatedMap.set(id, false)
    await sleep(1000 * 10)
  }
}
const joinAllChannels = async () => {
  const channelList = (await web.channels.list({ exclude_archived: true, exclude_members: true })).channels
  for (let channel of channelList) {
    // if it is not archived, channel-watcher try to join
    if (!channel.is_member && !channel.is_archived) {
      await joinChannel(channel.id)
    }
  }
}
const isChannelUnused = (id, threshold) => {
  const channel = getChannel(id)
  if (channel.is_archived) {
    return false
  }
  // if we don't have latest information, skip this channel
  if (!channel.latest || !isChannelUpdated(channel.id)) {
    return false
  }

  const lastUpdate = new Date(channel.latest.ts * 1000)
  const now = new Date()
  const isUnsed = (now - lastUpdate) > threshold
  return isUnsed
}
const getUnusedChannels = (threshold) => {
  const unusedChannels = []
  for (const id of channelsCache.keys()) {
    if (isChannelUnused(id, threshold)) {
      unusedChannels.push(id)
    }
  }
  return unusedChannels
}

// RTM
rtm.start().catch(console.error)
rtm.on('authenticated', async (initialData) => {
  console.log('logged in')
  // initialData.channels is set only when we received the response of rtm.start
  if (initialData.channels) {
    initChannelsCache(initialData.channels)
    await joinAllChannels()
    await updateAllChannelsCache()
  }
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
  deleteChannel(message.channel.id)
})
// call help if something went wrong
rtm.on('reconnecting', async () => {
  await web.chat.postMessage({
    channel: channelsCache.keys()[0],
    text: 'RTM reconnecting!'
  })
})
rtm.on('disconnecting', async () => {
  await web.chat.postMessage({
    channel: channelsCache.keys()[0],
    text: 'RTM disconnecting!'
  })
})
rtm.on('disconnected', async () => {
  // if the rtm is disconnected, we no longer get latest information
  // so we make all channelUpdatedMap false and post help
  for (let id of channelUpdatedMap.keys()) {
    channelUpdatedMap.set(id, false)
  }
  await web.chat.postMessage({
    channel: channelsCache.keys()[0],
    text: 'RTM disconnected! Someone please help me!'
  })
})

// hubot
module.exports = (robot) => {
  const formatChannels = (channels) => {
    return channels.map(function(id) {
      const channel = getChannel(id)
      return "#" + channel.name
    }).join(' ')
  }

  // say the list of channels to be killed
  robot.hear(new RegExp(robot.name + ' list ([0-9]+)days', 'i'), async (res) => {
    const days = parseInt(res.match[1])
    const threshold = days * 24 * 60 * 60 * 1000

    const channels = getUnusedChannels(threshold)
    const unusedChannels = formatChannels(channels)
    res.reply(`Following channels are not used for ${days} days: ${unusedChannels}`)
  })

  // archive the channel
  robot.hear(new RegExp(robot.name + ' kill ([0-9]+)days', 'i'), async (res) => {
    const days = parseInt(res.match[1])
    const threshold = days * 24 * 60 * 60 * 1000

    const channels = getUnusedChannels(threshold)
    const archivedChannels = formatChannels(channels)
    res.reply(`Following channels will be archived: ${archivedChannels}`)
    for (let id of channels) {
      // check if the channel information is updated properly. otherwise, we may have missed latest updates
      await web.channels.archive({ channel: id })
    }
  })

  // check status
  robot.hear(new RegExp(robot.name + ' status', 'i'), async (res) => {
    const unUpdatedChannels = formatChannels(getUnUpdatedChannels())
    res.reply(`Following channel's information is not fetched yet: ${unUpdatedChannels}`)
  })

  // fetch all channels data again
  robot.hear(new RegExp(robot.name + ' reload data', 'i'), async (res) => {
    await updateAllChannelsCache()
  })
}
