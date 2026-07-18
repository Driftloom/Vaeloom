import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Event, EventSubscription, PaginatedResponse } from '@vaeloom/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Publish an event' })
  publish(@CurrentUser() user: AuthedUser, @Body() dto: CreateEventDto): Promise<Event> {
    return this.events.publish(dto as unknown as Record<string, unknown>, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List events (paginated)' })
  findAll(@CurrentUser() user: AuthedUser): Promise<PaginatedResponse<Event>> {
    return this.events.findAll(user.id);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create an event subscription' })
  createSubscription(@CurrentUser() user: AuthedUser, @Body() dto: CreateSubscriptionDto): Promise<EventSubscription> {
    return this.events.createSubscription(dto as unknown as Record<string, unknown>, user.id);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List event subscriptions' })
  listSubscriptions(@CurrentUser() user: AuthedUser): Promise<PaginatedResponse<EventSubscription>> {
    return this.events.listSubscriptions(user.id);
  }
}
