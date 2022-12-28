import * as exprs from 'express';
const { Router } = exprs;
import { isAuthenticated } from '../../utils/authCheck.js';
import { signMessage, verifyMessage } from '../../controllers/lnd/message.js';

const router = Router();

router.post('/sign', isAuthenticated, signMessage);
router.post('/verify', isAuthenticated, verifyMessage);

export default router;
