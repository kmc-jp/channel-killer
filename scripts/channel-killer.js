module.exports = function(robot) {
  robot.respond(/list/i, function(res) {
    // say the list of channels to be killed
    res.reply("Following channels should be archived:");
  });
  robot.respond(/kill/i, function(res) {
    // archive the channel
    res.reply("");
  });
};
