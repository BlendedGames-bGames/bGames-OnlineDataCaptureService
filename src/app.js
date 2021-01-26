import logger from 'morgan';
import express from 'express';
import cookieParser from 'cookie-parser';

//Routes

import capture_data from './routes/capture_data';

const app = express();

//Middlewares
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//Routes
app.use(capture_data);

export default app;