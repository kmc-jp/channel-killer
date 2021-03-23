# Slack Channel Killer

Automatically archive unused channels.

## Run Channel Killer

Copy `.env.sample` to `.env`
Edit `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`

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
