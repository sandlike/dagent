from abc import ABC, abstractmethod


class TeamAdapter(ABC):
    @abstractmethod
    async def get_issue(self, issue_id: str) -> dict: ...

    @abstractmethod
    async def search_issues(self, query: str) -> list[dict]: ...

    @abstractmethod
    async def update_issue_status(self, issue_id: str, status: str) -> None: ...

    @abstractmethod
    async def add_comment(self, issue_id: str, comment: str) -> None: ...


class GitAdapter(ABC):
    @abstractmethod
    async def list_repos(self, org: str) -> list[dict]: ...

    @abstractmethod
    async def create_branch(self, repo_id: str, branch_name: str, base: str) -> dict: ...

    @abstractmethod
    async def create_pull_request(self, repo_id: str, title: str, head: str, base: str, body: str) -> dict: ...

    @abstractmethod
    async def get_file_content(self, repo_id: str, path: str, branch: str) -> str: ...

    @abstractmethod
    async def commit_files(self, repo_id: str, branch: str, files: list[dict], message: str) -> dict: ...
