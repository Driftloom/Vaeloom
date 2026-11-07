import { redirect } from 'next/navigation';
import SkillsIndexPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('SkillsIndexPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to the capabilities workbench with the skills category selected', async () => {
    await SkillsIndexPage({ params: Promise.resolve({ workspaceId: 'ws-test-123' }) });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/workspace/ws-test-123/capabilities?category=skills',
    );
  });

  it('falls back to the default workspace id when params are empty', async () => {
    await SkillsIndexPage({ params: Promise.resolve({} as { workspaceId: string }) });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/workspace/default-workspace/capabilities?category=skills',
    );
  });
});
