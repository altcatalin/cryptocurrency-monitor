# Cryptocurrency Monitor

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/) [![License: MIT](https://img.shields.io/npm/l/serverless.svg)](https://github.com/altcatalin/cryptocurrency-monitor/blob/master/LICENSE) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Faltcatalin%2Fcryptocurrency-monitor.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Faltcatalin%2Fcryptocurrency-monitor?ref=badge_shield)
[![Build Status](https://travis-ci.org/altcatalin/cryptocurrency-monitor.svg?branch=master)](https://travis-ci.org/altcatalin/cryptocurrency-monitor) [![Coverage Status](https://coveralls.io/repos/github/altcatalin/cryptocurrency-monitor/badge.svg?branch=master)](https://coveralls.io/github/altcatalin/cryptocurrency-monitor?branch=master) [![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/altcatalin/cryptocurrency-monitor/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/altcatalin/cryptocurrency-monitor/?branch=master) [![Known Vulnerabilities](https://snyk.io/test/github/altcatalin/cryptocurrency-monitor/badge.svg)](https://snyk.io/test/github/altcatalin/cryptocurrency-monitor) [![dependencies Status](https://david-dm.org/altcatalin/cryptocurrency-monitor/status.svg)](https://david-dm.org/altcatalin/cryptocurrency-monitor)

Serverless cryptocurrency monitor

## Getting Started

### Prerequisites

- [AWS account](https://aws.amazon.com/)
- AWS CLI [installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) and [configured](http://docs.aws.amazon.com/cli/latest/userguide/cli-config-files.html)
- [Twilio account](https://twilio.com/)
- [Node.js v6.10](https://nodejs.org/en/) - latest on AWS
- [Yarn](https://yarnpkg.com/en/)
- [Serverless Framework](https://serverless.com/)

### Installing

Create ```serverless.config.yml```

```
cp serverless.config.sample.yml serverless.config.yml
```

Edit ```serverless.config.yml``` and provide Twilio SID, Token and Sender Phone Number. 

```
twilio_sid: 
twilio_token: 
twilio_from: 
worker_rate: cron(*/10 * * * ? *)
worker_enabled: true
```

### Development & Test

Install dependencies

```
yarn install
```

Run the tests

```
npm test
```

### Deployment

```
serverless deploy
```
