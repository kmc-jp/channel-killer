var SlackClient = require('slack-client');

// var threshold = 30 * 24 * 60 * 60 * 1000;
var threshold = 60 * 1000;
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
var isChannelUnused = function(channel) {
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
var getUnusedChannels = function(callback) {
  var unusedChannels = Object.keys(client.channels).filter(function(id) {
    return isChannelUnused(client.channels[id]);
  });
  callback(unusedChannels);
};

client.login();
client.on('loggedIn', function(self, team) {
  console.log('logged in');
  joinAllChannels();
});
client.on('raw_message', function(message) {
  switch (message.type) {
    case 'message':
      client.channels[message.channel].latest = message;
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
  robot.respond(/list/i, function(res) {
    // say the list of channels to be killed
    res.reply("Following channels are not used:");
    getUnusedChannels(function(unusedChannels) {
      var list = unusedChannels.map(function(id) {
        return "#" + client.channels[id].name;
      });
      res.reply(list.join(", "));
    });
  });
  robot.respond(/kill/i, function(res) {
    // archive the channel
    res.reply("Following channels will be archived:");
    getUnusedChannels(function(unusedChannels) {
      var list = unusedChannels.map(function(id) {
        return "#" + client.channels[id].name;
      });
      res.reply(list.join(", "));
    });
  });
};
