# Slack Channel Killer

Automatically archive unused channels.

## Running Channel Killer

You can start Channel Killer locally by running:

```sh
$ HUBOT_SLACK_TOKEN="SLACK_TOKEN" ./bin/hubot --adapter slack
```

You need a user's slack token that starts with `xoxp-` (not a bot user's token!).

## Channel Killer's Command

- @username list
    - Shows the list of channels that will be archived
- @username kill
    - Archive unused channels
