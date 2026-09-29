@{
    RootModule        = 'DE-Microsoft-Admin.psm1'
    ModuleVersion     = '0.3.0'
    GUID              = '4fbb9cc8-52a6-4c83-93fb-6c9d0f7e2f6c'
    Author            = 'Digerati Experts'
    CompanyName       = 'Digerati Experts'
    Description       = 'Microsoft 365, Entra ID, Exchange Online, Intune, Autopilot and Azure administration for DE: least-privilege, paged, audited, signed Hub jobs.'
    PowerShellVersion = '5.1'
    FunctionsToExport = @(
        'Set-DEMsAuditPath',
        'Get-DEMsAuditPath',
        'New-DEResult',
        'Export-DEResult',
        'Get-DEMsScopeSet',
        'Connect-DEMicrosoft',
        'Get-DEMsContext',
        'ConvertTo-DEODataLiteral',
        'Invoke-DEGraphRequest',
        'Get-DETenantSummary',
        'Get-DEUser',
        'New-DEUser',
        'Set-DEUserAccountState',
        'Get-DEGroup',
        'New-DEGroup',
        'Add-DEGroupMember',
        'Get-DELicenseInventory',
        'Get-DEConditionalAccessPolicy',
        'Set-DEConditionalAccessPolicyState',
        'Get-DEMfaRegistration',
        'Get-DEEntraDevice',
        'Test-DEEntraBitLockerEscrow',
        'Connect-DEExchange',
        'Get-DEMailbox',
        'New-DESharedMailbox',
        'Set-DEMailboxPermission',
        'Set-DEMailboxAlias',
        'Set-DEMailboxForwarding',
        'Get-DETransportRule',
        'Connect-DEAzure',
        'Get-DEAzureSubscription',
        'Get-DEAzureInventory',
        'New-DEAzureResourceGroup',
        'New-DEAzureResourceLock',
        'Get-DEIntuneDevice',
        'Get-DEIntuneCompliancePolicy',
        'Get-DEIntuneConfigurationProfile',
        'Sync-DEIntuneDevice',
        'Invoke-DEIntuneDeviceAction',
        'Get-DEAutopilotDevice',
        'Get-DEAutopilotProfile',
        'Set-DEAutopilotGroupTag',
        'Remove-DEAutopilotDevice',
        'ConvertTo-DEJobCanonical',
        'Get-DEJobSignature',
        'New-DEMicrosoftJob',
        'Invoke-DEMicrosoftJob'
    )
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
    PrivateData       = @{ PSData = @{ Tags = @('MSP', 'Microsoft365', 'Entra', 'Intune', 'Autopilot', 'Exchange', 'Azure') } }
}
