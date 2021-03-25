# Slack Channel Killer

Automatically archive disused channels.

## Required Permissions

Your slack app needs...

- These bot scopes:
  - app_mentions:read
  - channels:history
  - channels:join
  - channels:manage
  - channels:read
  - chat:write
- Enable Socket Mode
- Subscribe these bot events:
  - app_mention
  - channel_created
  - channel_unarchive

## Run Channel Killer

Copy `.env.sample` to `.env`
Edit `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`

You can start Channel Killer by this command:

```sh
$ npm start
```

## Channel Killer's Command

- @username list [0-9]+days
    - Shows the list of channels that is disused for n days
- @username kill [0-9]+days
    - Archive disused channels

## Stop Channel Killer

```sh
$ npm stop
```
