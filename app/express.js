import express from 'express';
import expressValidator from 'express-validator';
import passport from 'passport';
import logger from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import httpStatus from 'http-status';
import passportJwt from 'passport-jwt';
import environment from './config/environment';
import winstonInstance from './config/winston';
import ApiError from './errors/api-error';
import ValidationError from './errors/validation-error';
import routes from './routes';
import user from './models/user';
import connection from './database';

const app = express();
const MongoStore = connectMongo(session);
const { Strategy, ExtractJwt } = passportJwt;
const {
  env,
  secretKey,
  sessionId,
  sessionTimeout,
  authTokenHeader
} = environment;

if (env === 'development') {
  app.use(logger('dev'));
}

winstonInstance.info('Initializing Body Parser');
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(expressValidator());

winstonInstance.info('Initializing Cookie Parser');
app.use(cookieParser());

winstonInstance.info('Initializing Session');
app.use(session({
  secret: secretKey,
	resave: false,
	saveUninitialized: false,
	name: sessionId,
	cookie: {
		// secure: true, // This works for https connections only.
		ephemeral: true, // Delete cookie when browser is closed.
		httpOnly: true, // Prevents browser javascript from accessing cookies.
		expires: new Date(Date.now() + sessionTimeout),
		maxAge: sessionTimeout
	},
	store: new MongoStore({ mongooseConnection: connection })
}));

winstonInstance.info('Initializing Passport');

// Use the passport package in our application
app.use(passport.initialize());
app.use(passport.session());

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeader(authTokenHeader),
  secretOrKey: secretKey
};

passport.use(new Strategy(jwtOptions, (payload, callback) => {
  user
    .findOne({ id: payload.id })
    .exec()
    .then((user) => {
      callback(undefined, user);
    })
    .catch((err) => {
      callback(err);
    });
}));

winstonInstance.info('Initializing /node-auth routes');

app.use((req, res, next) => {
  winstonInstance.log('Incoming Requests');
  next();
});

// mount all routes on /api path
app.use('/node-auth', routes);

// if error is not an instanceOf APIError, convert it.
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.status).json({ errors: err.validations });
  } else if (!(err instanceof ApiError)) {
		const apiError = new ApiError(err.message, err.status, err.isPublic);

		return next(apiError);
	}

	return next(err);
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  winstonInstance.error('Page Not found');
	const err = new ApiError('Page Not Found', httpStatus.NOT_FOUND);

	return next(err);
});

// error handler, send stacktrace only during development
app.use((err, req, res) => {
  res.status(err.status).json({
    errors: [
      {
        message: err.isPublic ? err.message : httpStatus[err.status],
        stack: env === 'development' ? err.stack : {}
      }
    ]
  });
});

export default app;
