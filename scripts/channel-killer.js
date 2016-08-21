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

var RtmClient = require('@slack/client').RtmClient;
var WebClient = require('@slack/client').WebClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var token = process.env.HUBOT_SLACK_TOKEN;
var web = new WebClient(token);
var rtm = new RtmClient(token);

var channels = [];

var getChannelIndex = function(id) {
  var result;
  channels.forEach(function(channel, i) {
    if (channel.id === id) {
      result = i;
    }
  });
  return result;
};
var getChannel = function(id) {
  var index = getChannelIndex(id);
  return channels[index];
};
var updateChannelInfo = function(id) {
  web.channels.info(id).then(function(info) {
    var index = getChannelIndex(id);
    if (index) {
      channels[index].latest = info.channel.latest;
    }
  });
};
var joinChannel = function(channel) {
  web.channels.join(channel.name);
  updateChannelInfo(channel.id);
};
var joinAllChannels = function() {
  web.channels.list().then(function(info) {
    info.channels.forEach(function(channel) {
      if (!channel.is_member) {
        joinChannel(channel);
      }
    });
  });
};

var isChannelUnused = function(channel, threshold) {
  if (channel.is_archived) {
    return false;
  }

  // channel.latestはjoinしているチャンネルしか取得できないのでjoinする
  if (!channel.latest) {
    joinChannel(channel);
    return false;
  }

  var lastUpdate = new Date(channel.latest.ts * 1000);
  return (new Date() - lastUpdate) > threshold;
};
var getUnusedChannels = function(threshold) {
  return channels.filter(function(channel) {
    return isChannelUnused(channel, threshold);
  });
};

rtm.start();
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
  console.log('logged in');
  channels = rtmStartData.channels;
  joinAllChannels();
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

module.exports = function(robot) {
  var formatChannels = function(channels) {
    return channels.map(function(channel) {
      return "#" + channel.name;
    }).join(' ');
  };

  // say the list of channels to be killed
  robot.respond(/list ([0-9]+)days/i, function(res) {
    var days = parseInt(res.match[1]);
    var threshold = days * 24 * 60 * 60 * 1000;
    res.reply('Following channels are not used for ' + days + 'days:');

    var channels = getUnusedChannels(threshold);
    res.reply(formatChannels(channels));
  });

  // archive the channel
  robot.respond(/kill ([0-9]+)days/i, function(res) {
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
