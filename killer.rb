require 'yaml'
require 'slack'

config = YAML.load_file('./config.yml')

Slack.configure do |c|
  c.token = config['slack']['token']
end

p Slack.channels_info(channel: 'C0436SFFP')

threshold = 30 * 24 * 60 * 60
Slack.channels_list['channels'].each do |c|
  unless c['is_archived']
    channel = Slack.channels_info(channel: c['id'])['channel']
    last_update = channel['latest'].nil? ? channel['topic']['last_set'] : channel['latest']['ts']
    if Time.now - Time.at(last_update.to_i) > threshold then
      p c['name'] + ' is going to be killed!!!'
    else
      p c['name'] + ' do not die'
    end
  end
end
