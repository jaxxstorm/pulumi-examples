program kubernetes;

uses
  Classes,
  SysUtils,
  fpjson,
  jsonparser;

var
  yaml: TJSONObject;


function createResource() : TJSONObject;
var
   resources, cluster, properties: TJSONObject;

begin
  properties := TJSONObject.Create;
  properties.Add('vpcId', '${vpcId}');
  properties.Add('subnetIds', '$subnetId}');
  properties.Add('instanceType', 't2.medium');
  properties.Add('desiredCapacity', 2);
  properties.Add('minSize', 1);
  properties.Add('maxSize', 2);

  cluster := TJSONObject.Create;
  cluster.Add('type', 'eks:Cluster');
  cluster.Add('properties', properties);

  resources := TJSONObject.Create;
  resources.Add('cluster', cluster);

  createResource:= resources;
end;

function createVariables(): TJSONObject;
var
  variables, subnetIds, subnetargs: TJSONObject;
  vpcId, vpcargs: TJSONObject;

begin
  subnetargs := TJSONObject.Create;
  subnetargs.Add('vpcId', '${vpcId}');

  subnetIds := TJSONObject.Create;
  subnetIds.Add('Fn::Invoke', subnetargs);
  subnetIds.Add('Function', 'aws:ec2:getSubnetIds');
  subnetIds.Add('Return', 'ids');

  vpcargs := TJSONObject.Create;
  vpcargs.Add('default',true);

  vpcId := TJSONObject.Create;
  vpcId.Add('Fn::Invoke', vpcargs);
  vpcId.Add('Function', 'aws:ec2:getVpc');
  vpcId.Add('Return','id');

  variables := TJSONObject.Create;
  variables.Add('subnetIds', subnetIds);
  variables.Add('vpcId', vpcId);

  createVariables := variables;
end;


begin
  yaml := TJSONObject.Create;
  yaml.Add('resources', createResource);
  yaml.Add('variables', createVariables);
  writeln(yaml.AsJSON);
end.