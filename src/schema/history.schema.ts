import Joi from 'joi';

export const historyQueryParams = Joi.object({
  p: Joi.number().min(0).default(0),
  pn: Joi.number().min(1).max(100).default(10)
});

export const historyIdParams = Joi.object({
  id: Joi.string().uuid().required()
});

export interface HistoryIdParams {
  id: string
}

export interface HistoryQueryParams {
  p: string;
  pn: string;
}