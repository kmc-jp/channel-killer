# Slack Channel Killer

Automatically archive unused channels.

## Run Channel Killer

Copy `.env.sample` to `.env`
Edit `HUBOT_SLACK_TOKEN` and `LOG_EXPORT_CHANNEL` in `.env`

You need a user's slack token that starts with `xoxp-` (not a bot user's token!).

You can start Channel Killer by this command:

```sh
$ npm run start
```

## Channel Killer's Command

- @username list
    - Shows the list of channels that will be archived
- @username kill
    - Archive unused channels

## Stop Channel Killer

```sh
$ npm run stop
```
