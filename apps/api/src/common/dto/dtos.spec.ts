import { CreateEventDto } from '../../events/dto/create-event.dto';
import { CreateSubscriptionDto } from '../../events/dto/create-subscription.dto';
import { CreateIntegrationDto } from '../../integrations/dto/create-integration.dto';
import { CreateMemoryDto } from '../../memory/dto/create-memory.dto';
import { SearchMemoryDto } from '../../memory/dto/search-memory.dto';
import { SearchRequestDto } from '../../search/dto/search-request.dto';
import 'reflect-metadata';

describe('DTOs', () => {
  it('should be instantiable', () => {
    expect(new CreateEventDto()).toBeDefined();
    expect(new CreateSubscriptionDto()).toBeDefined();
    expect(new CreateIntegrationDto()).toBeDefined();
    expect(new CreateMemoryDto()).toBeDefined();
    expect(new SearchMemoryDto()).toBeDefined();
    expect(new SearchRequestDto()).toBeDefined();
  });
});
