import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BatchPublishEventDto, PublishEventDto } from './dto/publish-event.dto';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/create-subscription.dto';
import { QueryDeadLetterDto, QueryEventDto, QuerySubscriptionDto } from './dto/query-event.dto';
import { EventsService } from './events.service';

@ApiTags('Event Bus')
@ApiBearerAuth()
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish an event with idempotency via correlationId' })
  async publish(@Body() dto: PublishEventDto) {
    const data = await this.eventsService.publish(dto);
    return { data };
  }

  @Post('events/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Batch publish events (up to 100)' })
  async batchPublish(@Body() batchDto: BatchPublishEventDto) {
    const data = await this.eventsService.batchPublish(batchDto);
    return { data };
  }

  @Get('events')
  @ApiOperation({ summary: 'List events with pagination and filters' })
  async findAll(@Query() query: QueryEventDto) {
    return this.eventsService.findAll(query);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get event details' })
  async findById(@Param('id') id: string) {
    const data = await this.eventsService.findById(id);
    return { data };
  }

  @Post('events/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed event' })
  async retry(@Param('id') id: string) {
    const data = await this.eventsService.retry(id);
    return { data };
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a subscription' })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    const data = await this.eventsService.createSubscription(dto);
    return { data };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List subscriptions' })
  async findAllSubscriptions(@Query() query: QuerySubscriptionDto) {
    const data = await this.eventsService.findAllSubscriptions(query);
    return { data };
  }

  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'Update a subscription' })
  async updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    const data = await this.eventsService.updateSubscription(id, dto);
    return { data };
  }

  @Delete('subscriptions/:id')
  @ApiOperation({ summary: 'Delete a subscription' })
  async deleteSubscription(@Param('id') id: string) {
    return this.eventsService.deleteSubscription(id);
  }

  @Get('dead-letter')
  @ApiOperation({ summary: 'List dead letter events' })
  async listDeadLetters(@Query() query: QueryDeadLetterDto) {
    return this.eventsService.listDeadLetters(query);
  }

  @Post('dead-letter/:id/replay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replay a dead letter event' })
  async replayDeadLetter(@Param('id') id: string) {
    const data = await this.eventsService.replayDeadLetter(id);
    return { data };
  }
}
