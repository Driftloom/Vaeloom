import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalCard } from './ApprovalCard';

describe('ApprovalCard', () => {
  const baseProps = {
    id: 'ap-1',
    agentName: 'Gmail',
    actionType: 'send-draft',
    description: 'Send draft to recruiter@example.com',
    onApprove: jest.fn(),
    onReject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders agent, action type and description', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText(/Gmail suggests/i)).toBeInTheDocument();
    expect(screen.getByText('send-draft')).toBeInTheDocument();
    expect(screen.getByText('Send draft to recruiter@example.com')).toBeInTheDocument();
  });

  it('calls onApprove with the approval id', () => {
    render(<ApprovalCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(baseProps.onApprove).toHaveBeenCalledWith('ap-1');
  });

  it('calls onReject with the approval id', () => {
    render(<ApprovalCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(baseProps.onReject).toHaveBeenCalledWith('ap-1');
  });

  it('shows diff, scopes, provenance and risk when provided', () => {
    render(
      <ApprovalCard
        {...baseProps}
        diff={{ oldText: 'old copy', newText: 'new copy' }}
        scopes={['gmail.send']}
        provenance={[{ label: 'message:abc123', confidence: 0.92 }]}
        risk="Sends an email to an external recipient"
        confidence={0.9}
      />,
    );
    expect(screen.getByRole('group', { name: 'Proposed changes' })).toBeInTheDocument();
    expect(screen.getByText('gmail.send')).toBeInTheDocument();
    expect(screen.getByText(/message:abc123/)).toBeInTheDocument();
    expect(screen.getByText(/Risk:/)).toBeInTheDocument();
    expect(screen.getByText(/Match confidence: 90%/)).toBeInTheDocument();
  });

  it('disables actions and announces expiry when expiresAt is in the past', () => {
    render(<ApprovalCard {...baseProps} expiresAt={new Date(Date.now() - 60000).toISOString()} />);
    expect(screen.getByText('Expired. No action was taken.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('shows the T3 warning for send-class actions', () => {
    render(<ApprovalCard {...baseProps} t3Warning />);
    expect(screen.getByRole('alert')).toHaveTextContent(/sends an email/i);
  });

  it('supports keyboard approve/reject on the card', () => {
    render(<ApprovalCard {...baseProps} />);
    const card = screen.getByRole('region', { name: /Gmail send-draft approval/i });
    fireEvent.keyDown(card, { key: 'a' });
    expect(baseProps.onApprove).toHaveBeenCalledWith('ap-1');
    fireEvent.keyDown(card, { key: 'r' });
    expect(baseProps.onReject).toHaveBeenCalledWith('ap-1');
  });
});
