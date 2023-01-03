const std = @import("std");
const json = std.json;

pub fn main() anyerror!void {
    const allocator = std.heap.page_allocator;


    const out_file = std.io.getStdOut();

    var obj = json.ObjectMap.init(allocator);
    defer obj.deinit();

    var outputs = json.ObjectMap.init(allocator);
    defer outputs.deinit();
    try outputs.putNoClobber("kubeconfig", .{ .String = "${cluster.kubeconfig}"});

    var cluster = json.ObjectMap.init(allocator);
    defer cluster.deinit();
    try cluster.putNoClobber("type", .{ .String = "eks:Cluster" });
    var properties = json.ObjectMap.init(allocator);
    defer properties.deinit();
    try properties.putNoClobber("desiredCapacity", .{ .Integer = 2 });
    try properties.putNoClobber("maxSize", .{ .Integer = 2 });
    try properties.putNoClobber("minSize", .{ .Integer = 1 });
    try properties.putNoClobber("instanceType", .{ .String = "t2.medium" });
    try properties.putNoClobber("subnetIds", .{ .String = "${subnetIds}" });
    try properties.putNoClobber("vpcId", .{ .String = "${vpcId}" });

    try cluster.putNoClobber("properties", .{ .Object = properties });

    var resources = json.ObjectMap.init(allocator);
    defer resources.deinit();
    try resources.putNoClobber("cluster", .{ .Object = cluster});


    var variables = json.ObjectMap.init(allocator);
    defer variables.deinit();
    var subnet_ids = json.ObjectMap.init(allocator);
    defer subnet_ids.deinit();
    var vpc_id = json.ObjectMap.init(allocator);
    defer vpc_id.deinit();


    var vpc_id_fn_invoke = json.ObjectMap.init(allocator);
    defer vpc_id_fn_invoke.deinit();
    try vpc_id_fn_invoke.putNoClobber("Function", .{ .String = "aws:ec2:getVpc" });
    try vpc_id_fn_invoke.putNoClobber("Return", .{ .String = "id" });
    var vpc_args = json.ObjectMap.init(allocator);
    defer vpc_args.deinit();
    try vpc_args.putNoClobber("default", .{ .Bool = true });
    try vpc_id_fn_invoke.putNoClobber("Arguments", .{ .Object = vpc_args });

    try vpc_id.putNoClobber("Fn::Invoke", .{ .Object = vpc_id_fn_invoke });
    try variables.putNoClobber("vpcId", .{ .Object = vpc_id });


    var subnet_id_fn_invoke = json.ObjectMap.init(allocator);
    defer subnet_id_fn_invoke.deinit();
    try subnet_id_fn_invoke.putNoClobber("Function", .{ .String = "aws:ec2:getSubnetIds" });
    try subnet_id_fn_invoke.putNoClobber("Return", .{ .String = "ids" });
    var subnet_args = json.ObjectMap.init(allocator);
    defer subnet_args.deinit();
    try subnet_args.putNoClobber("vpcId", .{ .String = "${vpcId}" });
    try subnet_id_fn_invoke.putNoClobber("Arguments", .{ .Object = vpc_args });

    try subnet_ids.putNoClobber("Fn::Invoke", .{ .Object = subnet_id_fn_invoke });
    try variables.putNoClobber("subnetIds", .{ .Object = subnet_ids });

    try obj.putNoClobber("outputs", .{ .Object = outputs});
    try obj.putNoClobber("resources", .{ .Object = resources});
    try obj.putNoClobber("variables", .{ .Object = variables });

    try (json.Value{ .Object = obj }).jsonStringify(.{}, out_file.writer());
}

