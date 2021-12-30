import jwt from 'jsonwebtoken';
import csurf from 'csurf/index.js';
import { Common, CommonService } from './common.js';

const common: CommonService = Common;
const csurfProtection = csurf({ cookie: true });

export const isAuthenticated = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, common.secret_key);
    next();
  } catch (error) {
    const errMsg = 'Authentication Failed! Please Login First!';
    const err = common.handleError({ statusCode: 401, message: 'Authentication Error', error: errMsg }, 'AuthCheck', errMsg, req.session.selectedNode);
    return res.status(err.statusCode).json({ message: err.message, error: err.error });
  }
};

export const verifyWSUser = (info, next) => {
  const headers = JSON.parse(JSON.stringify(info.req.headers));
  const protocols = !info.req.headers['sec-websocket-protocol'] ? [] : info.req.headers['sec-websocket-protocol'].split(',').map((s) => s.trim());
  const jwToken = (protocols && protocols.length > 0) ? protocols[0] : '';
  if (!jwToken || jwToken === '') {
    next(false, 401, 'Authentication Failed! Please Login First!');
  } else {
    jwt.verify(jwToken, common.secret_key, (verificationErr) => {
      if (verificationErr) {
        next(false, 401, 'Authentication Failed! Please Login First!');
      } else {
        const updatedReq = JSON.parse(JSON.stringify(info.req));
        updatedReq['cookies'] = !headers || !headers.cookie ? {} : '{"' + headers.cookie.replace(/ /g, '').replace(/;/g, '","').trim().replace(/[=]/g, '":"') + '"}';
        updatedReq['cookies'] = JSON.parse(updatedReq['cookies']);
        csurfProtection(updatedReq, null, (err) => {
          if (err) {
            next(false, 403, 'Invalid CSRF token!');
          } else {
            next(true);
          }
        });
      }
    });
  }
};