import path from 'path';
import loadsh from 'lodash';

const environment = process.env.NODE_ENV || 'development';
const config = require(`./${environment}`);

const defaults = {
	name: 'node-authentication',
	root: path.join(__dirname, '/..'),
	sessionId: 'node-auth-session-id',
	secretKey: 'node-auth-secret-key',
	authTokenHeader: 'node-auth-token',
	dbTimeout: 2 * 60 * 1000,
	dbPoolSize: 10,
	sessionTimeout: 3 * 60 * 60 * 1000
};

loadsh.assign(config, defaults);

export default config;
