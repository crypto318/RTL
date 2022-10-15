import { Database, DatabaseService } from '../../utils/database.js';
import { Logger, LoggerService } from '../../utils/logger.js';
import { Common, CommonService } from '../../utils/common.js';
import { CollectionFieldsEnum, CollectionsEnum, PageSettings } from '../../models/database.model.js';

const logger: LoggerService = Logger;
const common: CommonService = Common;
const databaseService: DatabaseService = Database;

export const getPageSettings = (req, res, next) => {
  logger.log({ selectedNode: req.session.selectedNode, level: 'INFO', fileName: 'Page Settings', msg: 'Getting Page Settings..' });
  databaseService.find(req.session.selectedNode, CollectionsEnum.PAGE_SETTINGS).then((settings: PageSettings) => {
    logger.log({ selectedNode: req.session.selectedNode, level: 'INFO', fileName: 'Page Settings', msg: 'Page Settings Received', data: settings });
    res.status(200).json(settings);
  }).catch((errRes) => {
    const err = common.handleError(errRes, 'Page Settings', 'Page Settings Error', req.session.selectedNode);
    return res.status(err.statusCode).json({ message: err.message, error: err.error });
  });
};

export const savePageSettings = (req, res, next) => {
  logger.log({ selectedNode: req.session.selectedNode, level: 'INFO', fileName: 'Page Settings', msg: 'Saving Page Settings..' });
  req.body = [
    {
      tables: [
        {
          tableId: "payments",
          recordsPerPage: 25,
          sortBy: "created_at",
          sortOrder: "Ascending",
          showColumns: [
            "msatoshi",
          ],
        },
        {
          tableId: "payments2",
          sortBy: "created_at",
          sortOrder: "Ascending",
          showColumns: [
            "created_at",
            "type",
            "payment_hash",
            "msatoshi_sent",
            "msatoshi",
          ],
        },
      ],
    },
    {
      pageId: "invoices",
      tables: [
        {
          tableId: "invoices3",
          sortBy: "expires_at",
          sortOrder: "Descending",
          showColumns: [
            "expires_at",
            "paid_at",
            "type",
            "description",
            "msatoshi",
            "msatoshi_received",
          ],
        },
      ],
    }
  ];
  return Promise.all(req.body.map((page) => databaseService.update(req.session.selectedNode, CollectionsEnum.PAGE_SETTINGS, page, CollectionFieldsEnum.PAGE_ID, page.pageId))).
    then((values) => {
      logger.log({ selectedNode: req.session.selectedNode, level: 'INFO', fileName: 'PayRequest', msg: 'Payment List Decoded', data: values });
      res.status(201).json(values);
    }).
    catch((errRes) => {
      const err = common.handleError(errRes, 'Page Settings', 'Page Settings Update Error', req.session.selectedNode);
      return res.status(err.statusCode).json({ message: err.message, error: err.error });
    });
};
