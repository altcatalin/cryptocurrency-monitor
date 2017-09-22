const AWS = require('aws-sdk');

const tableName = process.env.TABLE_NAME || '';
const topic = process.env.TOPIC || '';

let dynamo;
let sns;

function publish(rule) {
    const message = {
        Message: JSON.stringify({
            default: JSON.stringify(rule),
        }),
        MessageStructure: 'json',
        TopicArn: topic,
    };

    return sns.publish(message).promise();
}

function work(exclusiveStartKey) {
        const params = {
            TableName: tableName,
        };

        if (exclusiveStartKey !== undefined) {
            params.ExclusiveStartKey = exclusiveStartKey;
        }

        return dynamo.scan(params).promise()
            .then((response) => {
                if (response.Items.length > 0) {
                    return Promise.all(response.Items.map(publish))
                        .then(() => {
                            if (response.LastEvaluatedKey !== undefined) {
                                return work(response.LastEvaluatedKey);
                            }

                            return Promise.resolve();
                        });
                }

                return Promise.resolve();
            });
}

exports.handler = (event, context, callback) => {
    dynamo = new AWS.DynamoDB.DocumentClient();
    sns = new AWS.SNS();

    Promise.resolve()
        .then(work)
        .then(response => callback(null, response))
        .catch(callback);
};
