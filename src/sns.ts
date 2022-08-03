import AWS from 'aws-sdk'

AWS.config.update({ region: process.env.AWS_REGION });

export const sendSMS = async (message: string) => {
    console.log('Sending SMS message')
    const snsParams = {
        Message: message,
        TopicArn: process.env.AWS_TOPIC_ARN,
    };

    try {
        const publishTextPromise = await new AWS.SNS({apiVersion: '2010-03-31'}).publish(snsParams).promise();
        console.log(`Message "${snsParams.Message}" sent to the topic "${snsParams.TopicArn}"`);
        console.log("MessageID is " + publishTextPromise.MessageId); 
    } catch (e) {
        console.error(e);
    }
}
