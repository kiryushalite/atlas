[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RunId,

  [int]$Tail = 80,

  [switch]$Wait
)

& (Join-Path $PSScriptRoot "Watch-AgentRun.ps1") -RunId $RunId -Tail $Tail -Wait:$Wait
