Describe 'Native DE storage regression fixtures' {
    It 'preserves data, refuses unsafe cleanup/relocation, and explains drive roles' {
        & (Join-Path $PSScriptRoot 'Invoke-StorageRegression.ps1')
    }
}
