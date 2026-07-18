import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let responseMock: any;
  let hostMock: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    hostMock = {
      switchToHttp: () => ({
        getResponse: () => responseMock,
      }),
    };
  });

  it('should handle ThrottlerException', () => {
    const exception = new ThrottlerException();
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  });

  it('should handle BadRequestException with array message (validation)', () => {
    const exception = new BadRequestException(['error1', 'error2']);
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { validationErrors: ['error1', 'error2'] },
      },
    });
  });

  it('should handle BadRequestException with string message', () => {
    const exception = new BadRequestException('Bad request custom');
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad request custom',
      },
    });
  });

  it('should handle standard HttpException', () => {
    const exception = new HttpException('Forbidden custom', HttpStatus.FORBIDDEN);
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden custom',
      },
    });
  });

  it('should handle generic Error', () => {
    const exception = new Error('Generic error message');
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Generic error message',
      },
    });
  });

  it('should handle unknown exception', () => {
    const exception = 'unknown string error';
    filter.catch(exception, hostMock as ArgumentsHost);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });
});
