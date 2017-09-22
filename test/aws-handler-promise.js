module.exports = {
    resolve: (data) => {
        return {
            promise: () => Promise.resolve(data),
        };
    },
    reject: (data) => {
        return {
            promise: () => Promise.reject(data),
        };
    },
    handler: (fn, event, context) => new Promise((resolve, reject) => {
        fn.handler(event, context, (err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
    }),
};
