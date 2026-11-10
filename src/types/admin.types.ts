import { ObjectId } from 'mongodb';

export type AdminRole = 'admin' | 'superadmin';

export interface AdminDocument {
  _id?: ObjectId;
  email: string;
  name: string;
  role: AdminRole | string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAdminDTO = Omit<AdminDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateAdminDTO = Partial<CreateAdminDTO>;
