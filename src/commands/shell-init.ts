import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { error } from '../lib/ui.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function shellInitCommand(shell?: string) {
  const detected = shell || detectShell();

  switch (detected) {
    case 'powershell':
    case 'pwsh':
      console.log(getPowerShellInit());
      break;
    case 'bash':
    case 'zsh':
    case 'sh':
      console.log(getBashInit());
      break;
    default:
      error(`Unsupported shell: ${detected}. Use 'powershell' or 'bash'.`);
      process.exit(1);
  }
}

function detectShell(): string {
  const shell = process.env.SHELL || process.env.PSModulePath ? 'powershell' : 'bash';
  return shell;
}

function getPowerShellInit(): string {
  return `
function gw {
  param([string]$Name)
  if (-not $Name) {
    grove list
    return
  }
  $path = grove path $Name 2>$null
  if ($LASTEXITCODE -eq 0 -and $path) {
    Set-Location $path
  } else {
    Write-Host "Worktree '$Name' not found." -ForegroundColor Red
  }
}

Register-ArgumentCompleter -CommandName gw -ParameterName Name -ScriptBlock {
  param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
  $names = grove list --names-only 2>$null
  if ($names) {
    $names -split "\\r?\\n" | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
  }
}
`.trim();
}

function getBashInit(): string {
  return `
gw() {
  if [ -z "$1" ]; then
    grove list
    return
  fi
  local path
  path=$(grove path "$1" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$path" ]; then
    cd "$path"
  else
    echo "Worktree '$1' not found." >&2
  fi
}

_gw_completions() {
  local names
  names=$(grove list --names-only 2>/dev/null)
  COMPREPLY=($(compgen -W "$names" -- "\${COMP_WORDS[COMP_CWORD]}"))
}
complete -F _gw_completions gw
`.trim();
}
