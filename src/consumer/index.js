const AWS = require('aws-sdk');
const https = require('https');
const querystring = require('querystring');

const tableName = process.env.TABLE_NAME || '';
const twilioSid = process.env.TWILIO_SID || '';
const twilioToken = process.env.TWILIO_TOKEN || '';
const twilioFrom = process.env.TWILIO_FROM || '';

let dynamo;
let rule = {};
let price = 0;
let percent = 0;

const httpsRequest = (options, data) => new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
        const body = [];

        response.on('data', chunk => body.push(chunk));
        response.on('end', () => {
            try {
                const content = Buffer.concat(body).toString();

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Https request failed: ${response.statusCode} ${JSON.stringify(content)}`));
                } else {
                    resolve(content);
                }
            } catch (e) {
                reject(e);
            }
        });
    });

    if (data !== undefined) {
        request.write(data);
    }

    request.on('error', reject);
    request.end();
});

const validateRule = data => new Promise((resolve, reject) => {
    let valid = false;

    try {
        rule = JSON.parse(data.Records[0].Sns.Message);

        if (rule !== undefined && typeof rule === 'object') {
            valid = [
                'id',
                'name',
                'mobile',
                'currencyPair',
                'price',
                'priceType',
                'percent',
            ].reduce((acc, field) => (field in rule && acc === true), true);
        }

        if (valid) {
            resolve();
        } else {
            reject(new Error(`Invalid rule: ${JSON.stringify(rule)}`));
        }
    } catch (e) {
        reject(new Error(`Invalid SNS message: ${JSON.stringify(data)}`));
    }
});

const getPrice = () => {
    const options = {
        hostname: 'api.coinbase.com',
        path: `/v2/prices/${rule.currencyPair}/${rule.priceType}`,
        headers: {
            'CB-VERSION': '2017-05-19',
        },
    };

    return httpsRequest(options)
        .then(content => new Promise((resolve, reject) => {
            try {
                const data = JSON.parse(content);

                if (data.data !== undefined && data.data.amount !== undefined) {
                    price = parseInt(data.data.amount, 10);
                    resolve();
                } else {
                    reject(new Error(`Cannot extract price: ${JSON.stringify(data)}`));
                }
            } catch (e) {
                reject(e);
            }
        }));
};

const comparePrice = () => {
    percent = Math.ceil(((price - rule.price) / rule.price) * 100);
    const sum = percent + rule.percent;
    percent = (percent < 0) ? -percent : percent;

    return (sum <= 0 || sum >= rule.percent * 2);
};

const sendAlert = (trigger) => {
    if (trigger) {
        const type = (rule.price > price) ? 'down' : 'up';
        const message = querystring.stringify({
            From: twilioFrom,
            To: rule.mobile,
            Body: `${rule.currencyPair} ${type} with ${percent}% - new: ${price}, old: ${rule.price}`,
        });

        const options = {
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            method: 'POST',
            auth: `${twilioSid}:${twilioToken}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(message),
            },
        };

        return httpsRequest(options, message);
    }

    return Promise.resolve();
};

const updateRule = (trigger) => {
    if (trigger) {
        const params = {
            TableName: tableName,
            Key: {
                id: {
                    S: rule.id,
                },
            },
            UpdateExpression: 'SET price = :price',
            ExpressionAttributeValues: {
                ':price': {
                    N: price.toString(),
                },
            },
        };

        return dynamo.updateItem(params).promise();
    }

    return Promise.resolve();
};

exports.handler = (event, context, callback) => {
    dynamo = new AWS.DynamoDB();

    Promise.resolve(event)
        .then(validateRule)
        .then(getPrice)
        .then(comparePrice)
        .then(trigger => sendAlert(trigger)
            .then(() => updateRule(trigger))
            .then(() => Promise.resolve([rule.id, trigger])))
        .then(response => callback(null, response))
        .catch(callback);
};
