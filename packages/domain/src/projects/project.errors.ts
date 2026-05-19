export class ProjectNotFoundError extends Error {
  constructor() {
    super('Project not found.');
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectForbiddenError extends Error {
  constructor() {
    super('Forbidden.');
    this.name = 'ProjectForbiddenError';
  }
}
