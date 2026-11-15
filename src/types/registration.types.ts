import { ObjectId } from 'mongodb';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';
export type Gender = 'male' | 'female' | 'other';
export type DominantFoot = 'right' | 'left' | 'both';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';

export interface RegistrationDocument {
  _id?: ObjectId;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  position: string;
  experience: string;
  message?: string;
  gender: Gender;
  nationality: string;
  presentAddress: string;
  district: string;
  upazila: string;
  guardianName: string;
  guardianPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  primaryPosition: string;
  secondaryPosition?: string;
  preferredJerseyNumber: number;
  dominantFoot: DominantFoot;
  height: number;
  weight: number;
  experienceLevel: ExperienceLevel;
  yearsOfExperience: number;
  previousClub?: string;
  previousTournaments?: string;
  achievements?: string;
  currentInstitution?: string;
  hasInjury: boolean;
  injuryDetails?: string;
  allergies?: string;
  motivation: string;
  additionalNotes?: string;
  status: RegistrationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateRegistrationDTO = Omit<RegistrationDocument, '_id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: RegistrationStatus;
};
export type UpdateRegistrationDTO = Partial<Omit<RegistrationDocument, '_id' | 'createdAt' | 'updatedAt'>>;
