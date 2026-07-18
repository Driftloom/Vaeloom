import { SetMetadata } from '@nestjs/common';
import { SKIP_SERVICE_AUTH } from './service-auth.guard';

export const SkipServiceAuth = () => SetMetadata(SKIP_SERVICE_AUTH, true);
