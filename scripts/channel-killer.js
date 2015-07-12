// Description
//   Responses or archives unused channels.
//
// Configuration:
//   None
//
// Commands:
//   @hubot list ([0-9]+)days - returns unused channels
//   @hubot kill ([0-9]+)days - archives unused channels
//
// Author:
//   tyage <namatyage@gmail.com>

var SlackClient = require('slack-client');

var options = {
  token: process.env.HUBOT_SLACK_TOKEN,
  autoReconnect: true,
  autoMark: true
};
var client = new SlackClient(options.token, options.autoReconnect, options.autoMark);

var joinAllChannels = function() {
  Object.keys(client.channels).filter(function(id) {
    if (!client.channels[id].is_member) {
      client.joinChannel(client.channels[id].name);
    }
  });
};
var isChannelUnused = function(channel, threshold) {
  if (channel.is_archived) {
    return false;
  }
  // channel.latestはjoinしているチャンネルしか取得できない
  if (!channel.latest) {
    client.joinChannel(channel.name);
    return false;
  }

  var lastUpdate = new Date(channel.latest.ts * 1000);
  return (new Date() - lastUpdate) > threshold;
};
var getUnusedChannels = function(threshold) {
  return Object.keys(client.channels).filter(function(id) {
    return isChannelUnused(client.channels[id], threshold);
  });
};

client.login();
client.on('loggedIn', function(self, team) {
  console.log('logged in');
  joinAllChannels();
});
client.on('raw_message', function(message) {
  switch (message.type) {
    case 'message':
      if (client.channels[message.channel]) {
        client.channels[message.channel].latest = message;
      }
      break;
    case 'channel_left':
    case 'channel_unarchive':
      var channel = client.channels[message.channel];
      if (channel) {
        client.joinChannel(channel.name);
      }
      break;
    case 'channel_created':
      client.joinChannel(message.channel.name);
      break;
    default:
  }
});

module.exports = function(robot) {
  var formatChannels = function(channels) {
    return channels.map(function(channel) {
      return "#" + channel;
    }).join(' ');
  };

  // say the list of channels to be killed
  robot.respond(/list ([0-9]+)days/i, function(res) {
    var days = parseInt(res.match[1]);
    var threshold = days * 24 * 60 * 60 * 1000;
    res.reply("Following channels are not used for " + days + "days:");

    var channels = getUnusedChannels(threshold).map(function(id) {
      return client.channels[id].name;
    });
    res.reply(formatChannels(channels));
  });

  // archive the channel
  robot.respond(/kill ([0-9]+)days/i, function(res) {
    var threshold = parseInt(res.match[1]) * 24 * 60 * 60 * 1000;
    res.reply("Following channels will be archived:");

    var channels = getUnusedChannels(threshold).map(function(id) {
      client._apiCall('channels.archive', { channel: id });
      return client.channels[id].name;
    });
    res.reply(formatChannels(channels));
  });
};
