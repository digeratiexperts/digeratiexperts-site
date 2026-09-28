@{
    # DE Technician Console / MSP AI Kit loader analyzer policy.
    # Errors fail CI; warnings are reported. Excluded rules are deliberate:
    #  - PSAvoidUsingWriteHost: the loader and console write coloured progress for technicians; reusable
    #    functions return objects and never rely on Write-Host for data.
    #  - PSUseShouldProcessForStateChangingFunctions: state-changing functions declare SupportsShouldProcess;
    #    helpers named Set-/New- that only build in-memory objects are exempt.
    #  - PSAvoidUsingConvertToSecureStringWithPlainText: used only to wrap a value that arrived from a
    #    PasswordBox / runtime secret the instant before it is stored as SecureString.
    #  - PSUseSingularNouns / PSUseApprovedVerbs: a few names (Get-DEVendors, Get-DEPackages) read better plural.
    Severity     = @('Error', 'Warning')
    ExcludeRules = @(
        'PSAvoidUsingWriteHost',
        'PSUseShouldProcessForStateChangingFunctions',
        'PSAvoidUsingConvertToSecureStringWithPlainText',
        'PSUseSingularNouns',
        'PSUseApprovedVerbs',
        'PSReviewUnusedParameter',
        'PSAvoidGlobalVars',
        'PSAvoidUsingPositionalParameters',
        'PSUseDeclaredVarsMoreThanAssignments'
    )
    Rules        = @{
        PSUseCompatibleSyntax = @{ Enable = $true; TargetVersions = @('5.1', '7.4') }
        PSAvoidUsingCmdletAliases = @{ Enable = $true }
    }
}
