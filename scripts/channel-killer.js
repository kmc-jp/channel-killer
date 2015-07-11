var SlackClient = require('slack-client');

// var threshold = 30 * 24 * 60 * 60 * 1000;
var threshold = 60 * 1000;
var options = {
  token: process.env.HUBOT_SLACK_TOKEN,
  autoReconnect: true,
  autoMark: true
};
var client = new SlackClient(options.token, options.autoReconnect, options.autoMark);
client.login();
client.on('loggedIn', function(self, team) {
  console.log('logged in');
});

var isChannelUnused = function(channel) {
  if (channel.is_archived) {
    return false;
  }
  // channel.latestはjoinしているチャンネルしか取得できない
  if (!channel.latest) {
    client.joinChannel(channel.name);
    return false;
  }

  console.log(channel);
  var lastUpdate = new Date(channel.latest.ts * 1000);
  return (new Date() - lastUpdate) > threshold;
};
var getUnusedChannels = function(callback) {
  var unusedChannels = Object.keys(client.channels).filter(function(id) {
    return isChannelUnused(client.channels[id]);
  });
  callback(unusedChannels);
};

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
