export type LaunchSessionMode = 'legacy' | 'callback';

export class LaunchSessionStartResponseDto {
  ready: boolean;
  mode: LaunchSessionMode;
  code: number;
  message: string;
}
