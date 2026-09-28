# Digerati Experts MSP AI Kit - WPF console for the Windows loader.
# Dot-sourced by Install-MspAiKit.ps1 (Action Gui). Uses the loader's engine
# functions and its $script:Evidence / Write-Log pipeline; nothing here talks
# to the network or reads secrets. Requires Windows PowerShell 5.1 or
# PowerShell 7 on Windows (PresentationFramework).

$script:GuiXaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Digerati Experts MSP AI Kit"
        Width="1220" Height="800" MinWidth="1000" MinHeight="660"
        WindowStartupLocation="CenterScreen"
        Background="#FF050312" Foreground="#FFF7F5F2"
        FontFamily="Space Grotesk, Segoe UI Variable Text, Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Ideal" UseLayoutRounding="True" SnapsToDevicePixels="True">
  <Window.Resources>
    <SolidColorBrush x:Key="Well" Color="#FF050312"/>
    <SolidColorBrush x:Key="Surface" Color="#FF0A0A0A"/>
    <SolidColorBrush x:Key="Raised" Color="#FF151217"/>
    <SolidColorBrush x:Key="RaisedHover" Color="#FF1E1A22"/>
    <SolidColorBrush x:Key="Hairline" Color="#1AFFFFFF"/>
    <SolidColorBrush x:Key="Paper" Color="#FFF7F5F2"/>
    <SolidColorBrush x:Key="Muted" Color="#8CF7F5F2"/>
    <SolidColorBrush x:Key="Faint" Color="#59F7F5F2"/>
    <SolidColorBrush x:Key="Magenta" Color="#FFD3126A"/>
    <SolidColorBrush x:Key="MagentaHover" Color="#FFE8317F"/>
    <SolidColorBrush x:Key="Violet" Color="#FF7C3AED"/>
    <SolidColorBrush x:Key="Lavender" Color="#FFA78BFA"/>
    <SolidColorBrush x:Key="Pass" Color="#FF34D399"/>
    <SolidColorBrush x:Key="Warn" Color="#FFF5B942"/>

    <Style x:Key="Card" TargetType="Border">
      <Setter Property="Background" Value="{StaticResource Raised}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Hairline}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="CornerRadius" Value="12"/>
      <Setter Property="Padding" Value="16"/>
    </Style>
    <Style x:Key="Eyebrow" TargetType="TextBlock">
      <Setter Property="Foreground" Value="{StaticResource Muted}"/>
      <Setter Property="FontSize" Value="11"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Typography.Capitals" Value="AllSmallCaps"/>
    </Style>
    <Style x:Key="Mono" TargetType="TextBlock">
      <Setter Property="FontFamily" Value="Cascadia Mono, Consolas, Courier New"/>
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="Foreground" Value="{StaticResource Muted}"/>
    </Style>
    <Style x:Key="StateText" TargetType="TextBlock">
      <Setter Property="FontSize" Value="22"/>
      <Setter Property="FontWeight" Value="Bold"/>
      <Setter Property="FontFamily" Value="Oxanium, Space Grotesk, Segoe UI"/>
      <Setter Property="Margin" Value="0,6,0,2"/>
    </Style>

    <Style x:Key="Primary" TargetType="Button">
      <Setter Property="Background" Value="{StaticResource Magenta}"/>
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="BorderBrush" Value="Transparent"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Padding" Value="16,11"/>
      <Setter Property="Margin" Value="0,0,0,8"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="HorizontalContentAlignment" Value="Left"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="9" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Bd" Property="Background" Value="{StaticResource MagentaHover}"/>
              </Trigger>
              <Trigger Property="IsPressed" Value="True">
                <Setter TargetName="Bd" Property="Opacity" Value="0.85"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="Bd" Property="Opacity" Value="0.4"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="Ghost" TargetType="Button" BasedOn="{StaticResource Primary}">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Hairline}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="FontWeight" Value="Normal"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="9" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Bd" Property="Background" Value="{StaticResource RaisedHover}"/>
                <Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Lavender}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="Bd" Property="Opacity" Value="0.4"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="Danger" TargetType="Button" BasedOn="{StaticResource Ghost}">
      <Setter Property="Foreground" Value="{StaticResource Magenta}"/>
    </Style>
    <Style x:Key="Small" TargetType="Button" BasedOn="{StaticResource Ghost}">
      <Setter Property="Padding" Value="10,6"/>
      <Setter Property="Margin" Value="0,0,8,0"/>
      <Setter Property="FontSize" Value="12"/>
    </Style>

    <Style TargetType="TextBox">
      <Setter Property="Background" Value="{StaticResource Surface}"/>
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Hairline}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="8,6"/>
      <Setter Property="CaretBrush" Value="{StaticResource Magenta}"/>
      <Setter Property="SelectionBrush" Value="{StaticResource Violet}"/>
      <Setter Property="Margin" Value="0,2,0,8"/>
    </Style>
    <Style TargetType="CheckBox">
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Setter Property="Margin" Value="0,4,0,4"/>
    </Style>
    <Style TargetType="Expander">
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Setter Property="Margin" Value="0,8,0,0"/>
    </Style>
    <Style TargetType="ScrollViewer">
      <Setter Property="Background" Value="Transparent"/>
    </Style>

    <Style TargetType="DataGrid">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="RowBackground" Value="Transparent"/>
      <Setter Property="AlternatingRowBackground" Value="#0DFFFFFF"/>
      <Setter Property="GridLinesVisibility" Value="None"/>
      <Setter Property="HeadersVisibility" Value="Column"/>
      <Setter Property="AutoGenerateColumns" Value="False"/>
      <Setter Property="CanUserAddRows" Value="False"/>
      <Setter Property="IsReadOnly" Value="True"/>
      <Setter Property="SelectionMode" Value="Single"/>
      <Setter Property="RowHeaderWidth" Value="0"/>
    </Style>
    <Style TargetType="DataGridColumnHeader">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="{StaticResource Muted}"/>
      <Setter Property="FontSize" Value="11"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Padding" Value="8,6"/>
      <Setter Property="BorderThickness" Value="0,0,0,1"/>
      <Setter Property="BorderBrush" Value="{StaticResource Hairline}"/>
    </Style>
    <Style TargetType="DataGridCell">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Padding" Value="8,6"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="DataGridCell">
            <Border Padding="{TemplateBinding Padding}" Background="{TemplateBinding Background}">
              <ContentPresenter VerticalAlignment="Center"/>
            </Border>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
      <Style.Triggers>
        <Trigger Property="IsSelected" Value="True">
          <Setter Property="Background" Value="#2A7C3AED"/>
        </Trigger>
      </Style.Triggers>
    </Style>
    <Style TargetType="DataGridRow">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Style.Triggers>
        <DataTrigger Binding="{Binding Result}" Value="PASS">
          <Setter Property="Foreground" Value="{StaticResource Pass}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="NO CHANGE">
          <Setter Property="Foreground" Value="{StaticResource Pass}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="WARN">
          <Setter Property="Foreground" Value="{StaticResource Warn}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="BLOCKED">
          <Setter Property="Foreground" Value="{StaticResource Magenta}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="FAIL">
          <Setter Property="Foreground" Value="{StaticResource Magenta}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="PLANNED">
          <Setter Property="Foreground" Value="{StaticResource Lavender}"/>
        </DataTrigger>
        <DataTrigger Binding="{Binding Result}" Value="SKIPPED">
          <Setter Property="Foreground" Value="{StaticResource Muted}"/>
        </DataTrigger>
      </Style.Triggers>
    </Style>
  </Window.Resources>

  <Grid Margin="24,20,24,16">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <!-- Header -->
    <Grid Grid.Row="0" Margin="0,0,0,18">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <StackPanel Grid.Column="0" Orientation="Horizontal" VerticalAlignment="Center">
        <Border Width="6" Height="52" CornerRadius="3" Background="{StaticResource Magenta}" Margin="0,0,16,0"/>
        <StackPanel>
          <TextBlock Text="DIGERATI EXPERTS" Foreground="{StaticResource Magenta}" FontSize="11" FontWeight="Bold" FontFamily="Oxanium, Space Grotesk, Segoe UI"/>
          <TextBlock Text="MSP AI Kit" FontSize="28" FontWeight="SemiBold" Margin="0,-2,0,0"/>
          <TextBlock x:Name="TxtTagline" Text="Every pack, one click. Nothing to memorise." Foreground="{StaticResource Muted}" FontSize="13"/>
        </StackPanel>
      </StackPanel>
      <StackPanel Grid.Column="1" VerticalAlignment="Center" HorizontalAlignment="Right">
        <TextBlock x:Name="TxtIdentity" Style="{StaticResource Mono}" Foreground="{StaticResource Paper}" TextAlignment="Right"/>
        <TextBlock x:Name="TxtKitPath" Style="{StaticResource Mono}" TextAlignment="Right" Margin="0,4,0,0"/>
        <TextBlock x:Name="TxtProfile" Style="{StaticResource Mono}" TextAlignment="Right" Margin="0,2,0,0"/>
      </StackPanel>
    </Grid>

    <!-- Status cards -->
    <UniformGrid Grid.Row="1" Columns="4" Margin="-6,0,-6,16">
      <Border Style="{StaticResource Card}" Margin="6,0">
        <StackPanel>
          <TextBlock Text="PowerShell" Style="{StaticResource Eyebrow}"/>
          <TextBlock x:Name="CardPsState" Style="{StaticResource StateText}"/>
          <TextBlock x:Name="CardPsDetail" Style="{StaticResource Mono}"/>
        </StackPanel>
      </Border>
      <Border Style="{StaticResource Card}" Margin="6,0">
        <StackPanel>
          <TextBlock Text="Node.js" Style="{StaticResource Eyebrow}"/>
          <TextBlock x:Name="CardNodeState" Style="{StaticResource StateText}"/>
          <TextBlock x:Name="CardNodeDetail" Style="{StaticResource Mono}"/>
        </StackPanel>
      </Border>
      <Border Style="{StaticResource Card}" Margin="6,0">
        <StackPanel>
          <TextBlock Text="Skill install" Style="{StaticResource Eyebrow}"/>
          <TextBlock x:Name="CardSkillState" Style="{StaticResource StateText}"/>
          <TextBlock x:Name="CardSkillDetail" Style="{StaticResource Mono}"/>
        </StackPanel>
      </Border>
      <Border Style="{StaticResource Card}" Margin="6,0">
        <StackPanel>
          <TextBlock Text="Packs" Style="{StaticResource Eyebrow}"/>
          <TextBlock x:Name="CardPackState" Style="{StaticResource StateText}"/>
          <TextBlock x:Name="CardPackDetail" Style="{StaticResource Mono}" TextTrimming="CharacterEllipsis"/>
        </StackPanel>
      </Border>
    </UniformGrid>

    <!-- Body -->
    <Grid Grid.Row="2">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="360"/>
        <ColumnDefinition Width="16"/>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>

      <!-- Actions -->
      <Border Grid.Column="0" Style="{StaticResource Card}">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel>
            <TextBlock Text="Actions" Style="{StaticResource Eyebrow}" Margin="0,0,0,10"/>
            <Button x:Name="BtnAll" Style="{StaticResource Primary}" Content="Do everything   build, install, verify"/>
            <Button x:Name="BtnBuild" Style="{StaticResource Ghost}" Content="Build the packs"/>
            <Button x:Name="BtnInstall" Style="{StaticResource Ghost}" Content="Install as a skill for this user"/>
            <Button x:Name="BtnVerify" Style="{StaticResource Ghost}" Content="Verify   config check + tests"/>
            <Button x:Name="BtnUpstream" Style="{StaticResource Ghost}" Content="Fetch upstream kits   clone only"/>
            <Button x:Name="BtnNode" Style="{StaticResource Ghost}" Content="Install Node.js LTS with winget" Visibility="Collapsed"/>

            <TextBlock Text="ChatGPT" Style="{StaticResource Eyebrow}" Margin="0,12,0,8"/>
            <StackPanel Orientation="Horizontal">
              <Button x:Name="BtnCopyA" Style="{StaticResource Small}" Content="Copy Block A"/>
              <Button x:Name="BtnCopyB" Style="{StaticResource Small}" Content="Copy Block B"/>
              <Button x:Name="BtnOpenPacks" Style="{StaticResource Small}" Content="Open packs"/>
            </StackPanel>

            <TextBlock Text="Run mode" Style="{StaticResource Eyebrow}" Margin="0,14,0,4"/>
            <CheckBox x:Name="ChkDryRun" Content="Dry run   show the plan, change nothing"/>
            <CheckBox x:Name="ChkForce" Content="Force   replace a foreign skill folder"/>

            <TextBlock Text="Output folder" Style="{StaticResource Eyebrow}" Margin="0,10,0,0"/>
            <Grid>
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
              </Grid.ColumnDefinitions>
              <TextBox x:Name="TxtOut" Grid.Column="0"/>
              <Button x:Name="BtnBrowseOut" Grid.Column="1" Style="{StaticResource Small}" Content="Browse" Margin="8,2,0,8"/>
            </Grid>

            <Expander Header="Advanced">
              <StackPanel Margin="0,8,0,0">
                <TextBlock Text="Config file" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtConfig"/>
                <TextBlock Text="Only these modules (comma separated)" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtOnly"/>
                <TextBlock Text="Skip these modules" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtSkip"/>
                <TextBlock Text="Only these targets" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtTargets"/>
                <TextBlock Text="Overrides   key=value per line" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtSet" AcceptsReturn="True" MinHeight="54" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"/>
                <TextBlock Text="Cursor repo (rule is copied to .cursor\rules)" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtCursorRepo"/>
                <TextBlock Text="Upstream vendor folder" Style="{StaticResource Eyebrow}"/>
                <TextBox x:Name="TxtVendor"/>
                <Button x:Name="BtnUninstall" Style="{StaticResource Danger}" Content="Uninstall the skill links" Margin="0,8,0,0"/>
              </StackPanel>
            </Expander>
          </StackPanel>
        </ScrollViewer>
      </Border>

      <!-- Right column -->
      <Grid Grid.Column="2">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="12"/>
          <RowDefinition Height="220"/>
        </Grid.RowDefinitions>

        <!-- Next action -->
        <Border Grid.Row="0" Style="{StaticResource Card}" Padding="0" Margin="0,0,0,12">
          <Grid>
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="Auto"/>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <Border Grid.Column="0" Width="5" Background="{StaticResource Violet}" CornerRadius="12,0,0,12"/>
            <StackPanel Grid.Column="1" Margin="16,12">
              <TextBlock Text="Next recommended action" Style="{StaticResource Eyebrow}"/>
              <TextBlock x:Name="TxtNext" FontSize="16" FontWeight="SemiBold" Margin="0,4,0,0" TextWrapping="Wrap"/>
              <TextBlock x:Name="TxtNextWhy" Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,2,0,0"/>
            </StackPanel>
            <Button x:Name="BtnNext" Grid.Column="2" Style="{StaticResource Primary}" Content="Go" Margin="12,14,16,14" Padding="22,10"/>
          </Grid>
        </Border>

        <!-- Steps -->
        <Border Grid.Row="1" Style="{StaticResource Card}" Padding="12">
          <Grid>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
            </Grid.RowDefinitions>
            <Grid Grid.Row="0" Margin="4,0,4,8">
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
              </Grid.ColumnDefinitions>
              <TextBlock Text="Steps and evidence" Style="{StaticResource Eyebrow}" VerticalAlignment="Center"/>
              <StackPanel Grid.Column="1" Orientation="Horizontal">
                <Button x:Name="BtnReceipt" Style="{StaticResource Small}" Content="Export receipt"/>
                <Button x:Name="BtnBundle" Style="{StaticResource Small}" Content="Copy diagnostic bundle"/>
                <Button x:Name="BtnClear" Style="{StaticResource Small}" Content="Clear" Margin="0"/>
              </StackPanel>
            </Grid>
            <DataGrid x:Name="GridSteps" Grid.Row="1" FontSize="12">
              <DataGrid.Columns>
                <DataGridTextColumn Header="Step" Binding="{Binding Step}" Width="170"/>
                <DataGridTextColumn Header="Result" Binding="{Binding Result}" Width="95" FontWeight="Bold"/>
                <DataGridTextColumn Header="Action" Binding="{Binding Action}" Width="200"/>
                <DataGridTextColumn Header="Verification" Binding="{Binding Verification}" Width="*"/>
                <DataGridTextColumn Header="Fix" Binding="{Binding Remediation}" Width="220"/>
              </DataGrid.Columns>
            </DataGrid>
          </Grid>
        </Border>

        <!-- Log -->
        <Border Grid.Row="3" Style="{StaticResource Card}" Padding="12">
          <Grid>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
            </Grid.RowDefinitions>
            <Grid Grid.Row="0" Margin="4,0,4,6">
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="Auto"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
              </Grid.ColumnDefinitions>
              <TextBlock Text="Log   secrets redacted" Style="{StaticResource Eyebrow}" VerticalAlignment="Center" Margin="0,0,12,0"/>
              <TextBox x:Name="TxtLogSearch" Grid.Column="1" Margin="0" Padding="8,4" MaxWidth="360" HorizontalAlignment="Left" Width="300"/>
              <Button x:Name="BtnOpenLogs" Grid.Column="2" Style="{StaticResource Small}" Content="Open log folder" Margin="12,0,0,0"/>
            </Grid>
            <TextBox x:Name="TxtLog" Grid.Row="1" IsReadOnly="True" AcceptsReturn="True" TextWrapping="NoWrap"
                     VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Auto"
                     FontFamily="Cascadia Mono, Consolas, Courier New" FontSize="11.5" Margin="0" Background="{StaticResource Surface}"/>
          </Grid>
        </Border>
      </Grid>
    </Grid>

    <!-- Footer -->
    <Grid Grid.Row="3" Margin="0,14,0,0">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <TextBlock x:Name="TxtStatus" VerticalAlignment="Center" Foreground="{StaticResource Muted}"/>
      <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
        <TextBlock x:Name="TxtResult" FontWeight="Bold" Margin="0,0,16,0" VerticalAlignment="Center"/>
        <TextBlock x:Name="TxtVersion" Style="{StaticResource Mono}" Foreground="{StaticResource Faint}" VerticalAlignment="Center"/>
      </StackPanel>
    </Grid>
  </Grid>
</Window>
'@

$script:GuiStepTypeAdded = $false

function Initialize-GuiStepType {
    if ($script:GuiStepTypeAdded) { return }
    if (-not ('DE.MspAiKit.StepRow' -as [type])) {
        Add-Type -TypeDefinition @'
namespace DE.MspAiKit {
    public class StepRow {
        public string Step { get; set; }
        public string Result { get; set; }
        public string Action { get; set; }
        public string Verification { get; set; }
        public string Remediation { get; set; }
    }
}
'@
    }
    $script:GuiStepTypeAdded = $true
}

function Protect-GuiText {
    # Redacts anything that looks like a credential before it reaches the on-screen log or the bundle.
    param([string]$Text)
    if (-not $Text) { return $Text }
    $t = [regex]::Replace($Text, '(?i)\b(api[_ -]?key|token|secret|password|passwd|pwd|connect[_ -]?key|site[_ -]?token|recovery ?password)\b(\s*[:=]\s*)\S+', '$1$2[REDACTED]')
    $t = [regex]::Replace($t, '(?i)\bBearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'Bearer [REDACTED]')
    $t = [regex]::Replace($t, '\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b', '[REDACTED BITLOCKER KEY]')
    return $t
}

function Get-GuiControl {
    param([Parameter(Mandatory = $true)][string]$Name)
    $c = $script:Gui.Window.FindName($Name)
    if ($null -eq $c) { throw "GUI control '$Name' not found in XAML" }
    return $c
}

function Update-GuiPump {
    try { $script:Gui.Window.Dispatcher.Invoke([action] {}, [System.Windows.Threading.DispatcherPriority]::Background) } catch { }
}

function Update-GuiLog {
    $filter = $script:Gui.TxtLogSearch.Text
    $lines = $script:GuiLogLines
    if ($filter) { $lines = @($lines | Where-Object { $_ -like "*$filter*" }) }
    $script:Gui.TxtLog.Text = ($lines -join [Environment]::NewLine)
    $script:Gui.TxtLog.ScrollToEnd()
}

function Update-GuiSteps {
    $rows = New-Object System.Collections.Generic.List[DE.MspAiKit.StepRow]
    foreach ($e in $script:Evidence) {
        $r = New-Object DE.MspAiKit.StepRow
        $r.Step = "$($e.step)"; $r.Result = "$($e.result)"; $r.Action = Protect-GuiText "$($e.action)"
        $r.Verification = Protect-GuiText "$($e.verification)"; $r.Remediation = "$($e.remediation)"
        $rows.Add($r)
    }
    $script:Gui.GridSteps.ItemsSource = $null
    $script:Gui.GridSteps.ItemsSource = $rows
    if ($rows.Count -gt 0) { try { $script:Gui.GridSteps.ScrollIntoView($rows[$rows.Count - 1]) } catch { } }
    $worst = 'PASS'
    if ($script:ExitCode -eq 1) { $worst = 'FAIL' } elseif ($script:ExitCode -eq 2) { $worst = 'BLOCKED' }
    if ($script:Evidence.Count -eq 0) { $worst = 'READY' }
    $script:Gui.TxtResult.Text = ("Result  {0}" -f $worst)
    $brush = switch ($worst) { 'PASS' { 'Pass' } 'READY' { 'Lavender' } default { 'Magenta' } }
    $script:Gui.TxtResult.Foreground = $script:Gui.Window.FindResource($brush)
}

function Set-GuiCard {
    param([string]$Prefix, [string]$State, [string]$Detail)
    $stateCtl = Get-GuiControl ("Card{0}State" -f $Prefix)
    $detailCtl = Get-GuiControl ("Card{0}Detail" -f $Prefix)
    $stateCtl.Text = $State
    $detailCtl.Text = $Detail
    $brush = switch ($State) { 'PASS' { 'Pass' } 'READY' { 'Lavender' } 'WARN' { 'Warn' } default { 'Magenta' } }
    $stateCtl.Foreground = $script:Gui.Window.FindResource($brush)
}

function Update-GuiCards {
    $ps = $PSVersionTable.PSVersion
    Set-GuiCard -Prefix 'Ps' -State 'PASS' -Detail ("{0} {1}" -f $(if ($ps.Major -ge 6) { 'PowerShell' } else { 'Windows PowerShell' }), $ps)

    $nodeV = Get-NodeVersion
    if ($null -eq $nodeV) {
        Set-GuiCard -Prefix 'Node' -State 'BLOCKED' -Detail 'not installed'
        $script:Gui.BtnNode.Visibility = 'Visible'
    } elseif ($nodeV.Major -lt 18) {
        Set-GuiCard -Prefix 'Node' -State 'BLOCKED' -Detail ("node {0}: need 18+" -f $nodeV)
        $script:Gui.BtnNode.Visibility = 'Visible'
    } else {
        Set-GuiCard -Prefix 'Node' -State 'PASS' -Detail ("node {0}" -f $nodeV)
        $script:Gui.BtnNode.Visibility = 'Collapsed'
    }

    $link = Get-LinkTarget -Path (Join-Path (Join-Path $HOME '.claude') 'skills\msp-ai-kit')
    if ($null -eq $link) { Set-GuiCard -Prefix 'Skill' -State 'READY' -Detail 'not installed for this user' }
    elseif ($link -eq '') { Set-GuiCard -Prefix 'Skill' -State 'WARN' -Detail 'folder present (copy, not a link)' }
    else { Set-GuiCard -Prefix 'Skill' -State 'PASS' -Detail '~\.claude\skills\msp-ai-kit' }

    $packDir = $script:Gui.TxtOut.Text
    $index = Join-Path $packDir 'INDEX.md'
    if ($packDir -and (Test-Path -LiteralPath $index)) {
        $stamp = (Get-Item -LiteralPath $index).LastWriteTime.ToString('yyyy-MM-dd HH:mm')
        Set-GuiCard -Prefix 'Pack' -State 'PASS' -Detail ("built {0}" -f $stamp)
    } else {
        Set-GuiCard -Prefix 'Pack' -State 'READY' -Detail 'not built yet'
    }

    # next recommended action
    $next = 'Copy ChatGPT Block A'; $why = 'Packs are built and the skill is installed. Paste the two blocks into ChatGPT, then open INDEX.md for the rest.'; $script:Gui.NextAction = 'CopyA'
    if ($null -eq $nodeV -or $nodeV.Major -lt 18) { $next = 'Install Node.js LTS'; $why = 'The builder runs on Node.js 18 or newer. winget installs the LTS release for this user; nothing else changes.'; $script:Gui.NextAction = 'Node' }
    elseif (-not (Test-Path -LiteralPath $index)) { $next = 'Build the packs'; $why = ("Writes ChatGPT, Custom GPT, Claude, Cursor, Copilot and prompt files to {0}." -f $packDir); $script:Gui.NextAction = 'Build' }
    elseif ($null -eq $link) { $next = 'Install as a skill'; $why = 'Links this kit into ~\.claude\skills and ~\.agents\skills so Claude Code and Codex can run /msp-ai-kit. No admin rights needed.'; $script:Gui.NextAction = 'Install' }
    $script:Gui.TxtNext.Text = $next
    $script:Gui.TxtNextWhy.Text = $why
    $script:Gui.TxtStatus.Text = $(if ($script:Gui.ChkDryRun.IsChecked) { 'Dry run is on: every action reports its plan and changes nothing.' } else { 'Ready.' })
}

function Sync-GuiOptions {
    # Push the form into the loader's script-scoped parameters the engine reads.
    $split = { param($s) if ($s) { @($s -split '[,;\r\n]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) } else { $null } }
    $script:Only = & $split $script:Gui.TxtOnly.Text
    $script:Skip = & $split $script:Gui.TxtSkip.Text
    $script:Targets = & $split $script:Gui.TxtTargets.Text
    $script:Set = & $split $script:Gui.TxtSet.Text
    $script:CursorRepo = $script:Gui.TxtCursorRepo.Text.Trim()
    $script:Force = [bool]$script:Gui.ChkForce.IsChecked
    $script:WhatIfPreference = [bool]$script:Gui.ChkDryRun.IsChecked
    $script:VendorPath = $script:Gui.TxtVendor.Text.Trim()
    $script:Gui.PackDir = $script:Gui.TxtOut.Text.Trim()
    $script:Gui.ConfigPath = $script:Gui.TxtConfig.Text.Trim()
}

function Invoke-GuiAction {
    param([Parameter(Mandatory = $true)][string]$Label, [Parameter(Mandatory = $true)][scriptblock]$Work)
    if ($script:Gui.Busy) { return }
    $script:Gui.Busy = $true
    Sync-GuiOptions
    $script:Gui.TxtStatus.Text = ("Working: {0} ..." -f $Label)
    $script:Gui.Window.Cursor = [System.Windows.Input.Cursors]::Wait
    foreach ($b in $script:Gui.ActionButtons) { $b.IsEnabled = $false }
    Update-GuiPump
    try {
        & $Work
    } catch {
        Add-Evidence -Step 'gui' -Before $Label -ActionTaken 'unhandled error' -Result 'FAIL' -Verification $_.Exception.Message -Remediation 'See the log; rerun from PowerShell with -Verbose.'
    } finally {
        foreach ($b in $script:Gui.ActionButtons) { $b.IsEnabled = $true }
        $script:Gui.Window.Cursor = $null
        $script:Gui.Busy = $false
        Update-GuiSteps
        Update-GuiCards
        Update-GuiPump
    }
}

function Confirm-GuiDestructive {
    param([string]$Title, [string]$Message)
    $r = [System.Windows.MessageBox]::Show($script:Gui.Window, $Message, $Title, [System.Windows.MessageBoxButton]::YesNo, [System.Windows.MessageBoxImage]::Warning, [System.Windows.MessageBoxResult]::No)
    return ($r -eq [System.Windows.MessageBoxResult]::Yes)
}

function Copy-GuiBlock {
    param([int]$Index)
    $blocks = Get-ChatGptBlocks -PackDir $script:Gui.PackDir
    $label = @('Block A', 'Block B')[$Index]
    if ($null -eq $blocks) {
        Add-Evidence -Step ("clipboard.{0}" -f $label) -Before 'no pack' -ActionTaken 'read chatgpt-custom-instructions.md' -Result 'SKIPPED' -Remediation 'Build the packs first.'
        return
    }
    [System.Windows.Clipboard]::SetText($blocks[$Index])
    Add-Evidence -Step ("clipboard.{0}" -f $label) -Before 'pack present' -ActionTaken 'copied to clipboard' -Result 'PASS' -Verification ("{0} chars; paste into ChatGPT > Settings > Personalization > Custom instructions" -f $blocks[$Index].Length)
    $script:Gui.TxtStatus.Text = ("{0} is on the clipboard ({1} chars)." -f $label, $blocks[$Index].Length)
}

function Copy-GuiBundle {
    $sb = New-Object System.Text.StringBuilder
    $null = $sb.AppendLine(("DE MSP AI Kit loader {0} diagnostic bundle {1}" -f $script:ToolVersion, (Get-Date).ToString('o')))
    $null = $sb.AppendLine(("machine {0} user {1} ps {2} dryRun {3} exit {4}" -f $env:COMPUTERNAME, $env:USERNAME, $PSVersionTable.PSVersion, [bool]$WhatIfPreference, $script:ExitCode))
    $null = $sb.AppendLine(("kit {0}" -f $script:Gui.Root))
    $null = $sb.AppendLine(("packs {0}" -f $script:Gui.PackDir))
    $null = $sb.AppendLine(("log {0}" -f $script:LogFile))
    $null = $sb.AppendLine('--- steps')
    foreach ($e in $script:Evidence) { $null = $sb.AppendLine((Protect-GuiText ("{0} | {1} | {2} | {3} | {4} | {5}" -f $e.timestamp, $e.step, $e.result, $e.action, $e.verification, $e.remediation))) }
    $null = $sb.AppendLine('--- log (last 200 lines, redacted)')
    foreach ($l in @($script:GuiLogLines | Select-Object -Last 200)) { $null = $sb.AppendLine($l) }
    [System.Windows.Clipboard]::SetText($sb.ToString())
    $script:Gui.TxtStatus.Text = 'Diagnostic bundle copied. Paste it into the ticket.'
}

function Show-MspAiKitWindow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$ProfileName,
        [Parameter(Mandatory = $true)][string]$PackDir,
        [Parameter(Mandatory = $true)][string]$Config,
        [Parameter(Mandatory = $true)][string]$Vendor
    )
    Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
    Initialize-GuiStepType

    $script:Gui = @{ Busy = $false; Root = $Root; PackDir = $PackDir; ConfigPath = $Config; NextAction = 'Build' }
    $script:GuiLogLines = New-Object System.Collections.Generic.List[string]
    [xml]$xml = $script:GuiXaml
    $reader = New-Object System.Xml.XmlNodeReader $xml
    $script:Gui.Window = [Windows.Markup.XamlReader]::Load($reader)

    foreach ($name in @('TxtIdentity', 'TxtKitPath', 'TxtProfile', 'TxtTagline', 'BtnAll', 'BtnBuild', 'BtnInstall', 'BtnVerify', 'BtnUpstream', 'BtnNode',
            'BtnCopyA', 'BtnCopyB', 'BtnOpenPacks', 'ChkDryRun', 'ChkForce', 'TxtOut', 'BtnBrowseOut', 'TxtConfig', 'TxtOnly', 'TxtSkip', 'TxtTargets', 'TxtSet',
            'TxtCursorRepo', 'TxtVendor', 'BtnUninstall', 'TxtNext', 'TxtNextWhy', 'BtnNext', 'BtnReceipt', 'BtnBundle', 'BtnClear', 'GridSteps',
            'TxtLogSearch', 'BtnOpenLogs', 'TxtLog', 'TxtStatus', 'TxtResult', 'TxtVersion')) {
        $script:Gui[$name] = Get-GuiControl $name
    }
    $script:Gui.ActionButtons = @($script:Gui.BtnAll, $script:Gui.BtnBuild, $script:Gui.BtnInstall, $script:Gui.BtnVerify, $script:Gui.BtnUpstream, $script:Gui.BtnNode, $script:Gui.BtnUninstall, $script:Gui.BtnNext)

    # identity header and defaults
    $script:Gui.TxtIdentity.Text = ("{0}  \  {1}" -f $env:COMPUTERNAME, $env:USERNAME)
    $script:Gui.TxtKitPath.Text = $Root
    $script:Gui.TxtProfile.Text = ("profile {0}" -f $ProfileName)
    $script:Gui.TxtVersion.Text = ("loader {0}" -f $script:ToolVersion)
    $script:Gui.TxtOut.Text = $PackDir
    $script:Gui.TxtConfig.Text = $Config
    $script:Gui.TxtVendor.Text = $Vendor
    $script:Gui.ChkDryRun.IsChecked = [bool]$WhatIfPreference
    $script:Gui.ChkForce.IsChecked = [bool]$Force

    # route the engine's log into the window, redacted
    $script:LogSink = {
        param($line, $level)
        $script:GuiLogLines.Add((Protect-GuiText $line))
        if ($script:Gui -and $script:Gui.ContainsKey('TxtLog') -and $script:Gui.ContainsKey('TxtLogSearch')) { Update-GuiLog }
    }
    $script:NonInteractive = $true   # the window owns every prompt

    # handlers (all state through $script:Gui so they survive the dispatcher)
    $script:Gui.BtnBuild.Add_Click({ Invoke-GuiAction -Label 'build' -Work { if (Test-Prerequisites -NeedNode) { $null = Invoke-KitBuild -Root $script:Gui.Root -Destination $script:Gui.PackDir -Config $script:Gui.ConfigPath } } })
    $script:Gui.BtnInstall.Add_Click({
            if ($script:Gui.ChkForce.IsChecked -and -not (Confirm-GuiDestructive -Title 'Replace existing skill folder?' -Message "Force is on. Any existing msp-ai-kit entry under ~\.claude\skills or ~\.agents\skills that is not this kit will be deleted and replaced with a link. Continue?")) { return }
            Invoke-GuiAction -Label 'install' -Work { if (Test-Prerequisites) { $null = Install-Kit -Root $script:Gui.Root -PackDir $script:Gui.PackDir } }
        })
    $script:Gui.BtnVerify.Add_Click({ Invoke-GuiAction -Label 'verify' -Work { if (Test-Prerequisites -NeedNode) { $null = Test-Kit -Root $script:Gui.Root } } })
    $script:Gui.BtnUpstream.Add_Click({ Invoke-GuiAction -Label 'upstream kits' -Work { if (Test-Prerequisites -NeedGit) { $null = Install-UpstreamKits -Vendor $script:VendorPath } } })
    $script:Gui.BtnAll.Add_Click({
            Invoke-GuiAction -Label 'build, install, verify' -Work {
                if (Test-Prerequisites -NeedNode) {
                    if (Invoke-KitBuild -Root $script:Gui.Root -Destination $script:Gui.PackDir -Config $script:Gui.ConfigPath) {
                        $null = Install-Kit -Root $script:Gui.Root -PackDir $script:Gui.PackDir
                        $null = Test-Kit -Root $script:Gui.Root
                    }
                }
            }
        })
    $script:Gui.BtnNode.Add_Click({
            if (-not (Confirm-GuiDestructive -Title 'Install Node.js LTS?' -Message 'winget will install Node.js LTS (OpenJS.NodeJS.LTS) for this machine. This is the only software the loader ever installs. Continue?')) { return }
            Invoke-GuiAction -Label 'install Node.js' -Work { $null = Install-NodeWithWinget }
        })
    $script:Gui.BtnUninstall.Add_Click({
            if (-not (Confirm-GuiDestructive -Title 'Remove skill links?' -Message 'This removes the msp-ai-kit links under ~\.claude\skills and ~\.agents\skills. The kit files and built packs stay. Continue?')) { return }
            Invoke-GuiAction -Label 'uninstall' -Work { $null = Uninstall-Kit -Root $script:Gui.Root }
        })
    $script:Gui.BtnNext.Add_Click({
            switch ($script:Gui.NextAction) {
                'Node' { $script:Gui.BtnNode.RaiseEvent((New-Object System.Windows.RoutedEventArgs([System.Windows.Controls.Button]::ClickEvent))) }
                'Build' { $script:Gui.BtnBuild.RaiseEvent((New-Object System.Windows.RoutedEventArgs([System.Windows.Controls.Button]::ClickEvent))) }
                'Install' { $script:Gui.BtnInstall.RaiseEvent((New-Object System.Windows.RoutedEventArgs([System.Windows.Controls.Button]::ClickEvent))) }
                default { $script:Gui.BtnCopyA.RaiseEvent((New-Object System.Windows.RoutedEventArgs([System.Windows.Controls.Button]::ClickEvent))) }
            }
        })
    $script:Gui.BtnCopyA.Add_Click({ Sync-GuiOptions; Copy-GuiBlock -Index 0; Update-GuiSteps })
    $script:Gui.BtnCopyB.Add_Click({ Sync-GuiOptions; Copy-GuiBlock -Index 1; Update-GuiSteps })
    $script:Gui.BtnOpenPacks.Add_Click({ Sync-GuiOptions; if (Test-Path -LiteralPath $script:Gui.PackDir) { Invoke-Item -LiteralPath $script:Gui.PackDir } else { $script:Gui.TxtStatus.Text = 'Build the packs first.' } })
    $script:Gui.BtnOpenLogs.Add_Click({ if ($script:LogDir) { Invoke-Item -LiteralPath $script:LogDir } })
    $script:Gui.BtnReceipt.Add_Click({
            Sync-GuiOptions
            $p = Write-Receipt -PackDir $script:Gui.PackDir
            if ($p) { $script:Gui.TxtStatus.Text = ("Receipt written: {0}" -f $p); [System.Windows.Clipboard]::SetText($p) } else { $script:Gui.TxtStatus.Text = 'No writable log folder for the receipt.' }
        })
    $script:Gui.BtnBundle.Add_Click({ Sync-GuiOptions; Copy-GuiBundle })
    $script:Gui.BtnClear.Add_Click({ $script:Evidence.Clear(); $script:ExitCode = 0; Update-GuiSteps; Update-GuiCards })
    $script:Gui.BtnBrowseOut.Add_Click({
            try {
                Add-Type -AssemblyName System.Windows.Forms
                $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
                $dlg.Description = 'Folder for the generated packs'
                if (Test-Path -LiteralPath $script:Gui.TxtOut.Text) { $dlg.SelectedPath = $script:Gui.TxtOut.Text }
                if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $script:Gui.TxtOut.Text = $dlg.SelectedPath; Update-GuiCards }
            } catch { $script:Gui.TxtStatus.Text = 'Folder picker unavailable; type the path instead.' }
        })
    $script:Gui.ChkDryRun.Add_Click({ Sync-GuiOptions; Update-GuiCards })
    $script:Gui.TxtLogSearch.Add_TextChanged({ Update-GuiLog })
    $script:Gui.TxtOut.Add_LostFocus({ Update-GuiCards })

    Write-Log -Level STEP -Message 'GUI ready.'
    Update-GuiSteps
    Update-GuiCards
    $null = $script:Gui.Window.ShowDialog()
    $script:LogSink = $null
}
