export const TAU = Math.PI * 2;
export const RADIUS = 3.5;
export const HEX_ROTATION = Math.PI / 6;
export const REST_Z = 1.42;
export const BODY_HEIGHT = 1.72;
export const LEAF_Z = 2.98;
export const H_CENTER_Z = 2.42;

// Relative model coordinates; not dimensional measurements.
const layoutXY=(x,y)=>[(x-303)*3.5/250,(282-y)*3.5/250];
const suspension=[
  {root:layoutXY(273,102),tip:layoutXY(360,219)},
  {root:layoutXY(475,328),tip:layoutXY(330,345)},
  {root:layoutXY(177,420),tip:layoutXY(225,251)}
];
export const layout={
  suspension,
  horizontal:suspension.map(({root},index)=>{
    const radial=Math.atan2(root[1],root[0]);
    // The nearest hexagon side determines the motor axis, not the root radius.
    const sideNormal=HEX_ROTATION+Math.PI/6;
    const side=Math.round((radial-sideNormal)/(TAU/6));
    const angle=sideNormal+side*TAU/6+Math.PI/2;
    return {xy:[root[0]+Math.cos(angle)*.55,root[1]+Math.sin(angle)*.55],angle,pillar:index};
  }),
  sensors:[
    {xy:layoutXY(324,451),angle:Math.PI/6},
    {xy:layoutXY(450,201),angle:5*Math.PI/6},
    {xy:layoutXY(145,185),angle:3*Math.PI/2}
  ],
  // V motors retain threefold vertical actuation below L2, aligned to the sensor bays.
  vertical:[layoutXY(324,468),layoutXY(470,194),layoutXY(127,180)]
};
export const parts={
  base:{name:'L1 固定基座',code:'FIXED FOUNDATION',count:'01',color:'#81919e',symbol:'L1',description:'机加工六边形基座承载三根固定立柱和竖直电机定子。水平电机的固定端由立柱支承，安装高度位于 L2 箱体内。',facts:[['参考系','固定端'],['连接','立柱 / V 定子']]},
  platform:{name:'L2 箱式平台',code:'SUSPENDED STRUCTURE',count:'01',color:'#94a2b0',symbol:'L2',description:'带开孔侧板、内部舱格和三角加强板的六边形运动平台。内置水平电机活动端，传感器、隔板与箱体随 L2 整体运动。',facts:[['形态','分舱箱式结构'],['运动','六个刚体自由度']]},
  suspension:{name:'柔性悬挂组件',code:'FLEXURE SUSPENSION',count:'03',color:'#2787ab',symbol:'B',description:'三组渐缩悬挂片提供柔性支承。叶片根部压紧在固定立柱顶部，末端通过球铰与吊杆悬挂 L2 平台。',facts:[['组成','立柱 / 叶片 / 吊杆'],['分布','三点柔性悬挂']]},
  horizontal:{name:'水平音圈电机',code:'H ACTUATORS · INSIDE L2',count:'03',color:'#4e6d93',symbol:'H',description:'H1–H3 位于 L2 内部、三个悬挂根部邻近舱格。定子支承在 L1 立柱侧面，动子连接 L2 内部支架，沿局部水平方向施力。',facts:[['安装层','L2 内部'],['相邻结构','悬挂根部 / 立柱']]},
  vertical:{name:'竖直音圈电机',code:'V ACTUATORS · BELOW L2',count:'03',color:'#b37c52',symbol:'V',description:'三个竖直音圈电机位于 L1 与 L2 之间。定子固定在基座，轴向动子连接 L2 底板，正方向为 +Z。',facts:[['安装层','L1 与 L2 之间'],['方向','+Z 竖直向上']]},
  sensors:{name:'三轴惯性传感器',code:'TRIAXIAL INERTIAL SENSORS',count:'03',color:'#7c9786',symbol:'S',description:'三组惯性传感器固定在 L2 的独立舱格内。各自测量本体坐标系中的三轴速度，用于描述平台的平移与转动。',facts:[['输出','3 × 3 = 9 通道'],['安装','L2 传感器舱']]}
};
export const dofs={x:'X 轴 · 横移',y:'Y 轴 · 纵移',z:'Z 轴 · 升沉',rx:'Rx · 横滚',ry:'Ry · 俯仰',rz:'Rz · 偏航'};
