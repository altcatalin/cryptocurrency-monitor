# Cryptocurrency Monitor

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/) [![License: MIT](https://img.shields.io/npm/l/serverless.svg)](https://github.com/altcatalin/cryptocurrency-monitor/blob/master/LICENSE) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Faltcatalin%2Fcryptocurrency-monitor.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Faltcatalin%2Fcryptocurrency-monitor?ref=badge_shield)
[![Build Status](https://travis-ci.org/altcatalin/cryptocurrency-monitor.svg?branch=master)](https://travis-ci.org/altcatalin/cryptocurrency-monitor) [![Coverage Status](https://coveralls.io/repos/github/altcatalin/cryptocurrency-monitor/badge.svg?branch=master)](https://coveralls.io/github/altcatalin/cryptocurrency-monitor?branch=master) [![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/altcatalin/cryptocurrency-monitor/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/altcatalin/cryptocurrency-monitor/?branch=master) [![Known Vulnerabilities](https://snyk.io/test/github/altcatalin/cryptocurrency-monitor/badge.svg)](https://snyk.io/test/github/altcatalin/cryptocurrency-monitor) [![dependencies Status](https://david-dm.org/altcatalin/cryptocurrency-monitor/status.svg)](https://david-dm.org/altcatalin/cryptocurrency-monitor)

Serverless application on [AWS](https://aws.amazon.com/) that use [Coinbase](https://www.coinbase.com/) to monitor buy/sell/spot price and [Twilio](https://twilio.com/) to send SMS alerts.

## Getting Started

AWS Services in use:
- [Lambda](https://aws.amazon.com/lambda/)
- [DynamoDb](https://aws.amazon.com/dynamodb/)
- [Simple Notification Service (SNS)](https://aws.amazon.com/sns/)
- [CloudWatch](https://aws.amazon.com/cloudwatch/)
- [Identity and Access Management (IAM)](https://aws.amazon.com/iam/)

### Prerequisites

- [AWS account](https://aws.amazon.com/)
- [AWS CLI](https://aws.amazon.com/cli/)
- [Twilio account](https://twilio.com/)
- [Node.js v6.10](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/en/)
- [Serverless Framework v1.21](https://serverless.com/)

### Installing

Create ```serverless.config.yml```

```
cp serverless.config.sample.yml serverless.config.yml
```

Edit ```serverless.config.yml``` and provide Twilio SID, Token and Sender Phone Number (must follow [Twilio phone format](https://support.twilio.com/hc/en-us/articles/223183008-Formatting-International-Phone-Numbers)).

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
serverless deploy -v
```

## Alerts

Alerts are stored into cryptocurrency-monitor DynamoDb table. 

New alerts can be added through AWS Console using this format:

```
{
    "id": "6cd86d8f-1229-40e7-9aab-997cb2e065a8",
    "name": "ETH-EUR 5%",
    "mobile": "+12345678910",
    "currencyPair": "ETH-EUR",
    "price": 300,
    "priceType": "buy",
    "percent": 5
},
```

Alert fields:

- ```"id": "6cd86d8f-1229-40e7-9aab-997cb2e065a8"``` [UUID](https://www.uuidgenerator.net/)
- ```"name": "ETH-EUR 5%"``` Alert name
- ```"mobile": "+12345678910"``` Receiver's phone number. Must follow [Twilio phone format](https://support.twilio.com/hc/en-us/articles/223183008-Formatting-International-Phone-Numbers).
- ```"currencyPair": "ETH-EUR"``` [Coinbase currency pair](https://developers.coinbase.com/api/v2#exchange-rates)
- ```"price": 300``` Base price. It will be updated with the new price when the alert is triggered.
- ```"priceType": "buy"``` [Coinbase price type](https://developers.coinbase.com/api/v2#prices)
- ```"percent": 5``` Percent change (up or down).

