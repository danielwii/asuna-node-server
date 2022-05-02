import _ from 'lodash';

const awsS3Endpoint = {
  'us-east-1': 's3.amazonaws.com',
  'us-east-2': 's3.us-east-2.amazonaws.com',
  'us-west-1': 's3.us-west-1.amazonaws.com',
  'us-west-2': 's3.us-west-2.amazonaws.com',
  'ca-central-1': 's3.ca-central-1.amazonaws.com',
  'eu-west-1': 's3.eu-west-1.amazonaws.com',
  'eu-west-2': 's3.eu-west-2.amazonaws.com',
  'sa-east-1': 's3.sa-east-1.amazonaws.com',
  'eu-central-1': 's3.eu-central-1.amazonaws.com',
  'ap-south-1': 's3.ap-south-1.amazonaws.com',
  'ap-southeast-1': 's3.ap-southeast-1.amazonaws.com',
  'ap-southeast-2': 's3.ap-southeast-2.amazonaws.com',
  'ap-northeast-1': 's3.ap-northeast-1.amazonaws.com',
  'cn-north-1': 's3.cn-north-1.amazonaws.com.cn',
  'ap-east-1': 's3.ap-east-1.amazonaws.com',
  // Add new endpoints here.
};

export function isS3Endpoint(endpoint?: string): boolean {
  return !!_.find(_.values(awsS3Endpoint), (each) => endpoint?.endsWith(each));
}

export function getS3Region(endpoint?: string): string {
  return isS3Endpoint(endpoint) ? _.findKey(awsS3Endpoint, (value, key) => endpoint?.endsWith(value)) : null;
}
